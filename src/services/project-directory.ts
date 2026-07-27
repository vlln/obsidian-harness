import type { PlatformPath } from "path";

export interface ProjectDirectoryTarget {
	kind: "selected" | "default";
	cwd: string;
	needsCreate: boolean;
}

export interface ProjectDirectoryHost {
	homedir(): string;
	path: PlatformPath;
	isDirectory(path: string): Promise<boolean>;
	pathExists(path: string): Promise<boolean>;
}

export interface ProjectActionHost {
	isDirectory(cwd: string): Promise<boolean>;
	openDirectory(cwd: string): Promise<void>;
	writeClipboard(text: string): Promise<void>;
}

export class ProjectDirectoryValidationError extends Error {}

const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

export function normalizeProjectName(
	rawName: string,
	platform: NodeJS.Platform,
): string {
	const name = rawName.trim();
	if (!name)
		throw new ProjectDirectoryValidationError("Project name is required");
	if (name === "." || name === "..") {
		throw new ProjectDirectoryValidationError(
			"Project name cannot be . or ..",
		);
	}
	if (/\p{Cc}/u.test(name)) {
		throw new ProjectDirectoryValidationError(
			"Project name cannot contain control characters",
		);
	}
	if (/[\\/]/.test(name)) {
		throw new ProjectDirectoryValidationError(
			"Project name cannot contain path separators",
		);
	}
	if (/[. ]$/.test(rawName)) {
		throw new ProjectDirectoryValidationError(
			"Project name cannot end with a dot or space",
		);
	}
	if (platform === "win32") {
		if (/[<>:"|?*]/.test(name)) {
			throw new ProjectDirectoryValidationError(
				"Project name contains characters forbidden by Windows",
			);
		}
		if (WINDOWS_RESERVED_NAME.test(name)) {
			throw new ProjectDirectoryValidationError(
				"Project name is reserved by Windows",
			);
		}
	}
	return name;
}

export async function resolveDefaultProjectTarget(
	rawName: string,
	platform: NodeJS.Platform,
	host: ProjectDirectoryHost,
): Promise<ProjectDirectoryTarget> {
	const name = normalizeProjectName(rawName, platform);
	const home = host.homedir();
	if (!home || !host.path.isAbsolute(home)) {
		throw new ProjectDirectoryValidationError(
			"Unable to determine the default Documents directory",
		);
	}
	const cwd = host.path.normalize(host.path.join(home, "Documents", name));
	if (await host.pathExists(cwd)) {
		throw new ProjectDirectoryValidationError(
			`Folder already exists: ${cwd}. Select it explicitly or choose another name`,
		);
	}
	return { kind: "default", cwd, needsCreate: true };
}

export async function resolveSelectedProjectTarget(
	rawPath: string,
	host: ProjectDirectoryHost,
): Promise<ProjectDirectoryTarget> {
	if (!host.path.isAbsolute(rawPath)) {
		throw new ProjectDirectoryValidationError(
			"Source folder must be an absolute path",
		);
	}
	const cwd = host.path.normalize(rawPath);
	if (cwd === host.path.parse(cwd).root) {
		throw new ProjectDirectoryValidationError(
			"A filesystem root cannot be used as a Project folder",
		);
	}
	if (!(await host.isDirectory(cwd))) {
		throw new ProjectDirectoryValidationError(
			`Source folder does not exist or is not a directory: ${cwd}`,
		);
	}
	if (!host.path.basename(cwd)) {
		throw new ProjectDirectoryValidationError(
			"Source folder must have a directory name",
		);
	}
	return { kind: "selected", cwd, needsCreate: false };
}

export async function ensureProjectDirectory(
	cwd: string,
	host: Pick<ProjectActionHost, "isDirectory">,
): Promise<void> {
	if (!(await host.isDirectory(cwd))) {
		throw new Error(`Project folder is unavailable: ${cwd}`);
	}
}

export async function openProjectDirectory(
	cwd: string,
	host: Pick<ProjectActionHost, "isDirectory" | "openDirectory">,
): Promise<void> {
	await ensureProjectDirectory(cwd, host);
	await host.openDirectory(cwd);
}

export async function copyProjectPath(
	cwd: string,
	host: Pick<ProjectActionHost, "writeClipboard">,
): Promise<void> {
	await host.writeClipboard(cwd);
}
