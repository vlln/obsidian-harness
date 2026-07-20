import type { PromptContent } from "../types/chat";
import type { SessionUpdate, ToolCall, ToolCallUpdate } from "../types/session";
import {
	TRANSCRIPT_SCHEMA_VERSION,
	type ActiveTurnRecord,
	type TurnContext,
	type TurnRecord,
	type TurnStatus,
} from "../types/transcript";

interface UnknownSessionUpdate {
	type: string;
	sessionId: string;
}

export interface TurnAggregatorOptions {
	createId?: () => string;
	now?: () => string;
}

export interface StartTurnInput {
	turnId: string;
	prompt: PromptContent[];
	context?: TurnContext;
}

export interface CompleteTurnInput {
	status?: Exclude<TurnStatus, "interrupted">;
	stopReason?: string;
}

function clone<T>(value: T): T {
	return JSON.parse(JSON.stringify(value)) as T;
}

function mergeDefined<T extends object>(current: T, update: Partial<T>): T {
	const merged = { ...current };
	for (const [key, value] of Object.entries(update)) {
		if (value !== undefined) {
			(merged as Record<string, unknown>)[key] = clone(value);
		}
	}
	return merged;
}

export class TurnAggregator {
	private readonly createId: () => string;
	private readonly now: () => string;
	private active?: ActiveTurnRecord;
	private readonly toolIndexes = new Map<string, number>();
	private planIndex?: number;

	constructor(options: TurnAggregatorOptions = {}) {
		this.createId = options.createId ?? (() => crypto.randomUUID());
		this.now = options.now ?? (() => new Date().toISOString());
	}

	start(input: StartTurnInput): void {
		if (this.active) throw new Error("A transcript turn is already active");
		this.toolIndexes.clear();
		this.planIndex = undefined;
		this.active = {
			schemaVersion: TRANSCRIPT_SCHEMA_VERSION,
			turnId: input.turnId,
			status: "active",
			startedAt: this.now(),
			prompt: clone(input.prompt),
			items: [],
			...(input.context ? { context: clone(input.context) } : {}),
		};
	}

	apply(update: SessionUpdate | UnknownSessionUpdate): void {
		const turn = this.requireActive();
		const normalized = update as SessionUpdate;
		switch (normalized.type) {
			case "agent_message_chunk":
				this.appendText("assistant_message", normalized.text);
				break;
			case "agent_thought_chunk":
				this.appendText("thought", normalized.text);
				break;
			case "tool_call":
			case "tool_call_update":
				this.upsertTool(normalized);
				break;
			case "plan":
				if (this.planIndex === undefined) {
					this.planIndex = turn.items.length;
					turn.items.push({
						type: "plan",
						itemId: this.createId(),
						entries: clone(normalized.entries),
					});
				} else {
					const current = turn.items[this.planIndex];
					turn.items[this.planIndex] = {
						type: "plan",
						itemId: current.itemId,
						entries: clone(normalized.entries),
					};
				}
				break;
			case "usage_update":
				turn.usage = clone({
					used: normalized.used,
					size: normalized.size,
					...(normalized.cost ? { cost: normalized.cost } : {}),
				});
				break;
			case "current_mode_update":
				turn.context = {
					...turn.context,
					modeId: normalized.currentModeId,
				};
				break;
			case "config_option_update":
				turn.context = {
					...turn.context,
					configOptions: clone(normalized.configOptions),
				};
				break;
			case "process_error":
				turn.items.push({
					type: "error",
					itemId: this.createId(),
					message: normalized.error.message,
				});
				break;
			case "user_message_chunk":
			case "available_commands_update":
			case "session_info_update":
				break;
			default:
				turn.items.push({
					type: "unknown",
					itemId: this.createId(),
					updateType: update.type,
				});
		}
	}

	checkpoint(): ActiveTurnRecord {
		return clone(this.requireActive());
	}

	complete(input: CompleteTurnInput = {}): TurnRecord {
		const active = this.requireActive();
		const record: TurnRecord = {
			...clone(active),
			status: input.status ?? "completed",
			endedAt: this.now(),
			...(input.stopReason !== undefined
				? { stopReason: input.stopReason }
				: {}),
		};
		this.reset();
		return record;
	}

	interrupt(): TurnRecord {
		const active = this.requireActive();
		const record: TurnRecord = {
			...clone(active),
			status: "interrupted",
		};
		this.reset();
		return record;
	}

	private appendText(
		type: "assistant_message" | "thought",
		text: string,
	): void {
		if (text.length === 0) return;
		const turn = this.requireActive();
		const last = turn.items[turn.items.length - 1];
		if (last?.type === type) {
			last.text += text;
			return;
		}
		turn.items.push({ type, itemId: this.createId(), text });
	}

	private upsertTool(update: ToolCall | ToolCallUpdate): void {
		const turn = this.requireActive();
		const index = this.toolIndexes.get(update.toolCallId);
		if (index === undefined) {
			this.toolIndexes.set(update.toolCallId, turn.items.length);
			turn.items.push({
				type: "tool",
				itemId: this.createId(),
				toolCallId: update.toolCallId,
				status: update.status ?? "pending",
				...(update.title !== undefined ? { title: update.title } : {}),
				...(update.kind !== undefined ? { kind: update.kind } : {}),
				...(update.content !== undefined
					? { content: clone(update.content) }
					: {}),
				...(update.locations !== undefined
					? { locations: clone(update.locations) }
					: {}),
				...(update.rawInput !== undefined
					? { rawInput: clone(update.rawInput) }
					: {}),
				...(update.rawOutput !== undefined
					? { rawOutput: clone(update.rawOutput) }
					: {}),
				...(update.permissionRequest !== undefined
					? { permissionRequest: clone(update.permissionRequest) }
					: {}),
			});
			return;
		}

		const current = turn.items[index];
		if (current.type !== "tool") {
			throw new Error(`Transcript tool index ${index} is invalid`);
		}
		turn.items[index] = mergeDefined(current, {
			title: update.title,
			status: update.status,
			kind: update.kind,
			content: update.content,
			locations: update.locations,
			rawInput: update.rawInput,
			rawOutput: update.rawOutput,
			permissionRequest: update.permissionRequest,
		});
	}

	private requireActive(): ActiveTurnRecord {
		if (!this.active) throw new Error("No transcript turn is active");
		return this.active;
	}

	private reset(): void {
		this.active = undefined;
		this.toolIndexes.clear();
		this.planIndex = undefined;
	}
}
