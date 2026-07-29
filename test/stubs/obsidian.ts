/**
 * Lightweight `obsidian` stub for unit tests.
 *
 * The real `obsidian` module only exists inside the Obsidian runtime. The pure
 * utilities under test (`src/utils/platform.ts`, `src/utils/paths.ts`) only need
 * `Platform`, whose flags they read at call time. Tests mutate these flags to
 * exercise the platform-specific branches.
 */
export const Platform = {
	isWin: false,
	isMacOS: false,
	isLinux: false,
	isDesktopApp: true,
};

export type SecretStorageOperation =
	| "getSecret"
	| "setSecret"
	| "deleteSecret";

interface SecretFailureRule {
	operation: SecretStorageOperation;
	id?: string;
	error: Error;
	remainingMatches: number;
}

export interface SecretStorageCall {
	operation: SecretStorageOperation;
	id: string;
}

/**
 * Deterministic in-memory subset of Obsidian's secretStorage for unit tests.
 *
 * Mirrors the failure-injection and call-recording style of
 * `test/support/memory-data-adapter.ts`: `failNext`/`failOnOccurrence` arm
 * one-shot failures, and every invocation is appended to `calls`.
 */
export class MemorySecretStorage {
	private readonly secrets = new Map<string, string>();
	private readonly failures: SecretFailureRule[] = [];
	readonly calls: SecretStorageCall[] = [];

	constructor(state?: Record<string, string>) {
		if (!state) return;
		for (const [id, secret] of Object.entries(state)) {
			this.secrets.set(id, secret);
		}
	}

	failNext(
		operation: SecretStorageOperation,
		options: { id?: string; error?: Error } = {},
	): void {
		this.failOnOccurrence(operation, 1, options);
	}

	failOnOccurrence(
		operation: SecretStorageOperation,
		occurrence: number,
		options: { id?: string; error?: Error } = {},
	): void {
		if (!Number.isInteger(occurrence) || occurrence < 1) {
			throw new Error("Failure occurrence must be a positive integer");
		}
		this.failures.push({
			operation,
			id: options.id,
			error: options.error ?? new Error(`Injected ${operation} failure`),
			remainingMatches: occurrence,
		});
	}

	exportState(): Record<string, string> {
		return Object.fromEntries(this.secrets);
	}

	getSecret(id: string): string | null {
		this.maybeFail("getSecret", id);
		return this.secrets.get(id) ?? null;
	}

	setSecret(id: string, secret: string): void {
		this.maybeFail("setSecret", id);
		this.secrets.set(id, secret);
	}

	deleteSecret(id: string): void {
		this.maybeFail("deleteSecret", id);
		this.secrets.delete(id);
	}

	private maybeFail(operation: SecretStorageOperation, id: string): void {
		this.calls.push({ operation, id });
		const index = this.failures.findIndex(
			(rule) =>
				rule.operation === operation &&
				(rule.id === undefined || rule.id === id),
		);
		if (index < 0) return;
		const rule = this.failures[index];
		rule.remainingMatches -= 1;
		if (rule.remainingMatches > 0) return;
		this.failures.splice(index, 1);
		throw rule.error;
	}
}
