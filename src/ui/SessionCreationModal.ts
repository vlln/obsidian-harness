import { App, Modal, setIcon } from "obsidian";

import {
	resolveDefaultProjectTarget,
	resolveSelectedProjectTarget,
	type ProjectDirectoryHost,
	type ProjectDirectoryTarget,
} from "../services/project-directory";

interface SessionCreationModalOptions {
	host: ProjectDirectoryHost;
	platform: NodeJS.Platform;
	initialSourceDirectory?: string;
	pickDirectory(defaultPath?: string): Promise<string | null>;
	onCreate(
		target: ProjectDirectoryTarget,
		projectName: string,
	): Promise<void>;
}

export class SessionCreationModal extends Modal {
	private projectName = "new-project";
	private sourceDirectory: string | null;
	private submitting = false;
	private validationGeneration = 0;
	private readonly returnFocus: HTMLElement | null;

	constructor(
		app: App,
		private readonly options: SessionCreationModalOptions,
	) {
		super(app);
		this.sourceDirectory = options.initialSourceDirectory ?? null;
		if (this.sourceDirectory) {
			this.projectName = options.host.path.basename(
				options.host.path.normalize(this.sourceDirectory),
			);
		}
		this.returnFocus =
			document.activeElement instanceof HTMLElement
				? document.activeElement
				: null;
	}

	onOpen(): void {
		this.modalEl.addClass("agent-client-session-creation-modal");
		this.render();
	}

	private render(): void {
		const { contentEl } = this;
		contentEl.empty();
		contentEl.createEl("h2", { text: "Create project" });

		const nameField = contentEl.createDiv({
			cls: "agent-client-session-creation-field",
		});
		nameField.createEl("label", {
			text: "Project name",
			attr: { for: "agent-client-project-name" },
		});
		const nameInput = nameField.createEl("input", {
			type: "text",
			value: this.projectName,
			cls: "agent-client-session-creation-name",
			attr: { id: "agent-client-project-name" },
		});
		nameInput.disabled = this.sourceDirectory !== null || this.submitting;
		nameInput.addEventListener("input", () => {
			this.projectName = nameInput.value;
			void this.updateValidation(locationValue, issue, createButton);
		});

		const locationField = contentEl.createDiv({
			cls: "agent-client-session-creation-field",
		});
		locationField.createEl("span", {
			text: "Location",
			cls: "agent-client-session-creation-label",
		});
		const locationValue = locationField.createDiv({
			cls: "agent-client-session-creation-location",
			attr: { "aria-live": "polite" },
		});

		const sourceField = contentEl.createDiv({
			cls: "agent-client-session-creation-field",
		});
		sourceField.createEl("span", {
			text: "Source folder",
			cls: "agent-client-session-creation-label",
		});
		if (this.sourceDirectory) {
			const source = sourceField.createDiv({
				cls: "agent-client-session-creation-source",
			});
			source.createEl("span", {
				text: this.sourceDirectory,
				attr: { title: this.sourceDirectory },
			});
			const remove = source.createEl("button", {
				cls: "clickable-icon",
				attr: { "aria-label": "Remove source folder", type: "button" },
			});
			setIcon(remove, "x");
			remove.disabled = this.submitting;
			remove.addEventListener("click", () => {
				this.sourceDirectory = null;
				this.render();
			});
		} else {
			const addFolder = sourceField.createEl("button", {
				text: "Add folder",
				attr: { type: "button" },
			});
			addFolder.disabled = this.submitting;
			addFolder.addEventListener("click", () => {
				void this.options
					.pickDirectory()
					.then((selected) => {
						if (!selected) {
							addFolder.focus();
							return;
						}
						this.sourceDirectory = selected;
						this.projectName = this.options.host.path.basename(
							this.options.host.path.normalize(selected),
						);
						this.render();
					})
					.catch((error) => {
						issue.textContent = this.errorMessage(error);
					});
			});
		}

		const issue = contentEl.createDiv({
			cls: "agent-client-session-creation-issue",
			attr: { role: "status" },
		});
		const actions = contentEl.createDiv({
			cls: "agent-client-session-modal-actions",
		});
		const cancel = actions.createEl("button", { text: "Cancel" });
		cancel.disabled = this.submitting;
		cancel.addEventListener("click", () => this.close());
		const createButton = actions.createEl("button", {
			text: this.submitting ? "Creating..." : "Create project",
			cls: "mod-cta",
		});
		createButton.disabled = true;
		createButton.addEventListener("click", () => {
			void this.submit(issue, createButton);
		});

		void this.updateValidation(locationValue, issue, createButton).then(
			() => {
				window.setTimeout(() => {
					if (!nameInput.disabled) nameInput.focus();
					else
						sourceField
							.querySelector<HTMLButtonElement>("button")
							?.focus();
				}, 0);
			},
		);
	}

	private async resolveTarget(): Promise<ProjectDirectoryTarget> {
		return this.sourceDirectory
			? resolveSelectedProjectTarget(
					this.sourceDirectory,
					this.options.host,
				)
			: resolveDefaultProjectTarget(
					this.projectName,
					this.options.platform,
					this.options.host,
				);
	}

	private async updateValidation(
		location: HTMLElement,
		issue: HTMLElement,
		createButton: HTMLButtonElement,
	): Promise<void> {
		const generation = ++this.validationGeneration;
		createButton.disabled = true;
		try {
			const target = await this.resolveTarget();
			if (generation !== this.validationGeneration) return;
			location.textContent = target.cwd;
			location.title = target.cwd;
			location.setAttribute("aria-label", target.cwd);
			issue.textContent = "";
			createButton.disabled = this.submitting;
		} catch (error) {
			if (generation !== this.validationGeneration) return;
			location.textContent =
				this.sourceDirectory ?? "Location unavailable";
			location.title = location.textContent;
			issue.textContent = this.errorMessage(error);
		}
	}

	private async submit(
		issue: HTMLElement,
		createButton: HTMLButtonElement,
	): Promise<void> {
		if (this.submitting) return;
		this.submitting = true;
		createButton.disabled = true;
		createButton.textContent = "Creating...";
		try {
			const target = await this.resolveTarget();
			await this.options.onCreate(target, this.projectName);
			this.close();
		} catch (error) {
			this.submitting = false;
			issue.textContent = this.errorMessage(error);
			createButton.textContent = "Create project";
			createButton.disabled = this.sourceDirectory === null;
		}
	}

	private errorMessage(error: unknown): string {
		return error instanceof Error ? error.message : String(error);
	}

	onClose(): void {
		this.contentEl.empty();
		this.returnFocus?.focus();
	}
}
