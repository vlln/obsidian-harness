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
	readonly operations: { operation: AdapterOperation; path: string }[] = [];

	failNext(
		operation: AdapterOperation,
		options: { path?: string; error?: Error } = {},
	): void {
		this.failures.push({
			operation,
			path: options.path,
			error: options.error ?? new Error(`Injected ${operation} failure`),
		});
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
		if (content === undefined) throw new Error(`File not found: ${from}`);
		this.ensureParentFolders(to);
		this.files.set(to, content);
		this.files.delete(from);
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
		const [rule] = this.failures.splice(index, 1);
		throw rule.error;
	}
}
