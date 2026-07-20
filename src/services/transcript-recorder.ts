import type { PromptContent } from "../types/chat";
import type { SessionUpdate } from "../types/session";
import type {
	ActiveTurnRecord,
	TurnContext,
	TurnRecord,
} from "../types/transcript";
import {
	TurnAggregator,
	type CompleteTurnInput,
} from "./transcript-aggregator";

export interface TranscriptRecorderStorage {
	writeCheckpoint(
		historyId: string,
		checkpoint: ActiveTurnRecord,
	): Promise<void>;
	commitTurn(historyId: string, turn: TurnRecord): Promise<void>;
}

export type TranscriptPersistenceState =
	| { state: "idle" }
	| { state: "saving"; pendingTurnId?: string }
	| { state: "saved" }
	| { state: "error"; message: string; pendingTurnId?: string };

export interface TranscriptRecorderOptions {
	createId?: () => string;
	now?: () => string;
	checkpointDelayMs?: number;
}

export class TranscriptRecorder {
	private readonly aggregator: TurnAggregator;
	private readonly createId: () => string;
	private readonly checkpointDelayMs: number;
	private active = false;
	private checkpointTimer?: ReturnType<typeof setTimeout>;
	private writeChain: Promise<void> = Promise.resolve();
	private pendingTurn?: TurnRecord;
	private state: TranscriptPersistenceState = { state: "idle" };
	private readonly listeners = new Set<
		(state: TranscriptPersistenceState) => void
	>();

	constructor(
		private readonly storage: TranscriptRecorderStorage,
		private readonly historyId: string,
		options: TranscriptRecorderOptions = {},
	) {
		this.createId = options.createId ?? (() => crypto.randomUUID());
		this.aggregator = new TurnAggregator({
			createId: options.createId,
			now: options.now,
		});
		this.checkpointDelayMs = options.checkpointDelayMs ?? 500;
	}

	start(prompt: PromptContent[], context?: TurnContext): string {
		const turnId = this.createId();
		this.aggregator.start({ turnId, prompt, context });
		this.active = true;
		return turnId;
	}

	apply(update: SessionUpdate): void {
		if (!this.active) return;
		this.aggregator.apply(update);
		this.scheduleCheckpoint();
	}

	async flushCheckpoint(): Promise<boolean> {
		this.clearCheckpointTimer();
		if (!this.active) return true;
		const checkpoint = this.aggregator.checkpoint();
		let succeeded = true;
		this.enqueueWrite(async () => {
			this.setState({ state: "saving" });
			try {
				await this.storage.writeCheckpoint(this.historyId, checkpoint);
				this.setState({ state: "saved" });
			} catch (error) {
				succeeded = false;
				this.setState({
					state: "error",
					message: this.errorMessage(error),
				});
			}
		});
		await this.writeChain;
		return succeeded;
	}

	async complete(input: CompleteTurnInput = {}): Promise<boolean> {
		if (!this.active) return this.retry();
		this.clearCheckpointTimer();
		await this.writeChain;
		this.pendingTurn = this.aggregator.complete(input);
		this.active = false;
		return this.retry();
	}

	async interrupt(): Promise<boolean> {
		if (!this.active) return this.retry();
		this.clearCheckpointTimer();
		await this.writeChain;
		this.pendingTurn = this.aggregator.interrupt();
		this.active = false;
		return this.retry();
	}

	async retry(): Promise<boolean> {
		if (this.active) return this.flushCheckpoint();
		if (!this.pendingTurn) return true;
		const turn = this.pendingTurn;
		this.setState({ state: "saving", pendingTurnId: turn.turnId });
		try {
			await this.storage.commitTurn(this.historyId, turn);
			if (this.pendingTurn?.turnId === turn.turnId) {
				this.pendingTurn = undefined;
			}
			this.setState({ state: "saved" });
			return true;
		} catch (error) {
			this.setState({
				state: "error",
				message: this.errorMessage(error),
				pendingTurnId: turn.turnId,
			});
			return false;
		}
	}

	getPersistenceState(): TranscriptPersistenceState {
		return this.state;
	}

	onPersistenceStateChange(
		listener: (state: TranscriptPersistenceState) => void,
	): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private scheduleCheckpoint(): void {
		if (this.checkpointTimer !== undefined) return;
		this.checkpointTimer = setTimeout(() => {
			this.checkpointTimer = undefined;
			void this.flushCheckpoint();
		}, this.checkpointDelayMs);
	}

	private clearCheckpointTimer(): void {
		if (this.checkpointTimer === undefined) return;
		clearTimeout(this.checkpointTimer);
		this.checkpointTimer = undefined;
	}

	private enqueueWrite(write: () => Promise<void>): void {
		this.writeChain = this.writeChain.then(write, write);
	}

	private setState(state: TranscriptPersistenceState): void {
		this.state = state;
		for (const listener of this.listeners) listener(state);
	}

	private errorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}
}
