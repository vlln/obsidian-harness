import {
	appendFile,
	mkdir,
	readFile,
	readdir,
	rename,
	rm,
	writeFile,
} from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, relative } from "node:path";

/**
 * Minimal real-filesystem adapter matching Obsidian's DataAdapter subset used by
 * SessionStorage. Paths are vault-relative; the adapter roots them at `base`.
 * Used to prove the plugin reader consumes on-disk sessions produced by the
 * companion importer.
 */
export class NodeDataAdapter {
	constructor(private readonly base: string) {}

	private resolve(path: string): string {
		return join(this.base, path);
	}

	async exists(path: string): Promise<boolean> {
		return existsSync(this.resolve(path));
	}

	async mkdir(path: string): Promise<void> {
		await mkdir(this.resolve(path), { recursive: true });
	}

	async write(path: string, content: string): Promise<void> {
		await mkdir(dirname(this.resolve(path)), { recursive: true });
		await writeFile(this.resolve(path), content, "utf8");
	}

	async append(path: string, content: string): Promise<void> {
		await mkdir(dirname(this.resolve(path)), { recursive: true });
		await appendFile(this.resolve(path), content, "utf8");
	}

	async read(path: string): Promise<string> {
		return readFile(this.resolve(path), "utf8");
	}

	async rename(from: string, to: string): Promise<void> {
		await mkdir(dirname(this.resolve(to)), { recursive: true });
		await rename(this.resolve(from), this.resolve(to));
	}

	async remove(path: string): Promise<void> {
		await rm(this.resolve(path), { force: true });
	}

	async rmdir(path: string, recursive: boolean): Promise<void> {
		await rm(this.resolve(path), { recursive, force: true });
	}

	async list(
		path: string,
	): Promise<{ files: string[]; folders: string[] }> {
		const absolute = this.resolve(path);
		if (!existsSync(absolute)) return { files: [], folders: [] };
		const entries = await readdir(absolute, { withFileTypes: true });
		const files: string[] = [];
		const folders: string[] = [];
		for (const entry of entries) {
			const relativePath = relative(
				this.base,
				join(absolute, entry.name),
			);
			if (entry.isDirectory()) folders.push(relativePath);
			else files.push(relativePath);
		}
		return { files, folders };
	}
}
