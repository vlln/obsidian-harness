import type {
	PermissionOption,
	PlanEntry,
	PromptContent,
	ToolCallContent,
	ToolCallLocation,
	ToolCallStatus,
	ToolKind,
} from "./chat";
import type { SessionConfigOption, SessionUsage } from "./session";

export const TRANSCRIPT_SCHEMA_VERSION = 2 as const;

export type TranscriptSchemaVersion = typeof TRANSCRIPT_SCHEMA_VERSION;
export type TurnStatus = "completed" | "cancelled" | "interrupted" | "error";

export interface BlobRef {
	type: "blob_ref";
	schemaVersion: TranscriptSchemaVersion;
	sha256: string;
	mediaType: string;
	byteLength: number;
	preview: string;
}

export interface TurnContext {
	modeId?: string;
	configOptions?: SessionConfigOption[];
}

export interface AssistantMessageItem {
	type: "assistant_message";
	itemId: string;
	text: string;
}

export interface ThoughtItem {
	type: "thought";
	itemId: string;
	text: string;
}

export interface ToolItem {
	type: "tool";
	itemId: string;
	toolCallId: string;
	title?: string;
	status: ToolCallStatus;
	kind?: ToolKind;
	content?: ToolCallContent[];
	locations?: ToolCallLocation[];
	rawInput?: Record<string, unknown>;
	rawOutput?: Record<string, unknown> | BlobRef;
	permissionRequest?: {
		requestId: string;
		options: PermissionOption[];
		selectedOptionId?: string;
		isCancelled?: boolean;
		isActive?: boolean;
	};
}

export interface PlanItem {
	type: "plan";
	itemId: string;
	entries: PlanEntry[];
}

export interface ErrorItem {
	type: "error";
	itemId: string;
	message: string;
}

export interface UnknownItem {
	type: "unknown";
	itemId: string;
	updateType: string;
}

export type TranscriptItem =
	| AssistantMessageItem
	| ThoughtItem
	| ToolItem
	| PlanItem
	| ErrorItem
	| UnknownItem;

interface TurnBase {
	schemaVersion: TranscriptSchemaVersion;
	turnId: string;
	startedAt: string;
	prompt: PromptContent[];
	items: TranscriptItem[];
	usage?: SessionUsage;
	context?: TurnContext;
}

export interface ActiveTurnRecord extends TurnBase {
	status: "active";
}

export interface TurnRecord extends TurnBase {
	status: TurnStatus;
	endedAt?: string;
	stopReason?: string;
}

export interface TranscriptManifest {
	schemaVersion: TranscriptSchemaVersion;
	historyId: string;
	createdAt: string;
	updatedAt: string;
	metadata: {
		agentId: string;
		cwd: string;
		title: string;
	};
}

export type TranscriptWarningCode =
	| "corrupt_manifest"
	| "corrupt_turn"
	| "duplicate_turn"
	| "corrupt_checkpoint"
	| "missing_blob"
	| "corrupt_blob"
	| "missing_transcript";

export interface TranscriptWarning {
	code: TranscriptWarningCode;
	path: string;
	message: string;
	expectedSha256?: string;
}

export interface TranscriptReadResult {
	manifest?: TranscriptManifest;
	turns: TurnRecord[];
	warnings: TranscriptWarning[];
}
