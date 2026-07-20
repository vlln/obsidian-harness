export type AdapterOperation =
	| "append"
	| "exists"
	| "list"
	| "mkdir"
	| "read"
	| "remove"
	| "rename"
	| "rmdir"
	| "write";

interface FailureRule {
	operation: AdapterOperation;
	path?: string;
	error: Error;
	remainingMatches: number;
}

export interface MemoryDataAdapterState {
	files: Array<[string, string]>;
	folders: string[];
}

export interface AdapterListResult {
	files: string[];
	folders: string[];
}

function parentPath(path: string): string {
	const separator = path.lastIndexOf("/");
	return separator < 0 ? "" : path.slice(0, separator);
}

/** Deterministic in-memory subset of Obsidian's DataAdapter for storage tests. */
export class MemoryDataAdapter {
	private readonly files = new Map<string, string>();
	private readonly folders = new Set<string>([""]);
	private readonly failures: FailureRule[] = [];
	private readonly checkpointFailures = new Map<string, Error>();
	readonly operations: { operation: AdapterOperation; path: string }[] = [];
	readonly checkpoints: string[] = [];

	constructor(state?: MemoryDataAdapterState) {
		if (!state) return;
		for (const [path, content] of state.files)
			this.files.set(path, content);
		for (const folder of state.folders) this.folders.add(folder);
	}

	failNext(
		operation: AdapterOperation,
		options: { path?: string; error?: Error } = {},
	): void {
		this.failOnOccurrence(operation, 1, options);
	}

	failOnOccurrence(
		operation: AdapterOperation,
		occurrence: number,
		options: { path?: string; error?: Error } = {},
	): void {
		if (!Number.isInteger(occurrence) || occurrence < 1) {
			throw new Error("Failure occurrence must be a positive integer");
		}
		this.failures.push({
			operation,
			path: options.path,
			error: options.error ?? new Error(`Injected ${operation} failure`),
			remainingMatches: occurrence,
		});
	}

	failAtCheckpoint(name: string, error?: Error): void {
		this.checkpointFailures.set(
			name,
			error ?? new Error(`Injected checkpoint failure: ${name}`),
		);
	}

	checkpoint(name: string): void {
		this.checkpoints.push(name);
		const error = this.checkpointFailures.get(name);
		if (!error) return;
		this.checkpointFailures.delete(name);
		throw error;
	}

	exportState(): MemoryDataAdapterState {
		return {
			files: [...this.files.entries()],
			folders: [...this.folders],
		};
	}

	cloneForReload(): MemoryDataAdapter {
		return new MemoryDataAdapter(this.exportState());
	}

	seedFile(path: string, content: string): void {
		this.ensureParentFolders(path);
		this.files.set(path, content);
	}

	getFile(path: string): string | undefined {
		return this.files.get(path);
	}

	hasFile(path: string): boolean {
		return this.files.has(path);
	}

	async exists(path: string): Promise<boolean> {
		this.maybeFail("exists", path);
		return this.files.has(path) || this.folders.has(path);
	}

	async mkdir(path: string): Promise<void> {
		this.maybeFail("mkdir", path);
		this.ensureParentFolders(`${path}/child`);
		this.folders.add(path);
	}

	async write(path: string, content: string): Promise<void> {
		this.maybeFail("write", path);
		this.ensureParentFolders(path);
		this.files.set(path, content);
	}

	async append(path: string, content: string): Promise<void> {
		this.maybeFail("append", path);
		this.ensureParentFolders(path);
		this.files.set(path, `${this.files.get(path) ?? ""}${content}`);
	}

	async read(path: string): Promise<string> {
		this.maybeFail("read", path);
		const content = this.files.get(path);
		if (content === undefined) throw new Error(`File not found: ${path}`);
		return content;
	}

	async rename(from: string, to: string): Promise<void> {
		this.maybeFail("rename", from);
		const content = this.files.get(from);
		if (content !== undefined) {
			this.ensureParentFolders(to);
			this.files.set(to, content);
			this.files.delete(from);
			return;
		}
		if (!this.folders.has(from)) throw new Error(`Path not found: ${from}`);
		if (this.files.has(to) || this.folders.has(to)) {
			throw new Error(`Path already exists: ${to}`);
		}
		this.ensureParentFolders(`${to}/child`);
		const prefix = `${from}/`;
		for (const [path, value] of [...this.files.entries()]) {
			if (!path.startsWith(prefix)) continue;
			this.files.set(`${to}/${path.slice(prefix.length)}`, value);
			this.files.delete(path);
		}
		for (const folder of [...this.folders]) {
			if (folder !== from && !folder.startsWith(prefix)) continue;
			const suffix = folder === from ? "" : folder.slice(prefix.length);
			this.folders.add(suffix ? `${to}/${suffix}` : to);
			this.folders.delete(folder);
		}
	}

	async remove(path: string): Promise<void> {
		this.maybeFail("remove", path);
		this.files.delete(path);
	}

	async rmdir(path: string, recursive: boolean): Promise<void> {
		this.maybeFail("rmdir", path);
		const prefix = `${path}/`;
		const hasChildren =
			[...this.files.keys()].some((file) => file.startsWith(prefix)) ||
			[...this.folders].some(
				(folder) => folder !== path && folder.startsWith(prefix),
			);
		if (hasChildren && !recursive) {
			throw new Error(`Directory not empty: ${path}`);
		}
		for (const file of this.files.keys()) {
			if (file.startsWith(prefix)) this.files.delete(file);
		}
		for (const folder of this.folders) {
			if (folder === path || folder.startsWith(prefix)) {
				this.folders.delete(folder);
			}
		}
	}

	async list(path: string): Promise<AdapterListResult> {
		this.maybeFail("list", path);
		const prefix = path ? `${path}/` : "";
		return {
			files: [...this.files.keys()].filter(
				(file) =>
					file.startsWith(prefix) &&
					!file.slice(prefix.length).includes("/"),
			),
			folders: [...this.folders].filter(
				(folder) =>
					folder.startsWith(prefix) &&
					folder !== path &&
					!folder.slice(prefix.length).includes("/"),
			),
		};
	}

	private ensureParentFolders(path: string): void {
		const parent = parentPath(path);
		if (!parent) return;
		let current = "";
		for (const part of parent.split("/")) {
			current = current ? `${current}/${part}` : part;
			this.folders.add(current);
		}
	}

	private maybeFail(operation: AdapterOperation, path: string): void {
		this.operations.push({ operation, path });
		const index = this.failures.findIndex(
			(rule) =>
				rule.operation === operation &&
				(rule.path === undefined || rule.path === path),
		);
		if (index < 0) return;
		const rule = this.failures[index];
		rule.remainingMatches -= 1;
		if (rule.remainingMatches > 0) return;
		this.failures.splice(index, 1);
		throw rule.error;
	}
}
