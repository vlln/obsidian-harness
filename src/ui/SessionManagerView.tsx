import {
	ItemView,
	Menu,
	Modal,
	Notice,
	WorkspaceLeaf,
	setIcon,
} from "obsidian";
import * as React from "react";
const { useCallback, useEffect, useMemo, useRef, useState } = React;
import { useSyncExternalStore } from "react";
import { createRoot, type Root } from "react-dom/client";

import type AgentClientPlugin from "../plugin";
import {
	getVisibleNavigatorItems,
	searchSessionCatalog,
} from "../services/session-navigator";
import type {
	SessionCatalogItem,
	SessionRuntimeStatus,
} from "../types/session-catalog";

export const VIEW_TYPE_SESSION_MANAGER = "agent-client-session-manager";

function ObsidianIcon({
	name,
	className = "",
	label,
}: {
	name: string;
	className?: string;
	label?: string;
}) {
	const ref = useRef<HTMLSpanElement>(null);
	useEffect(() => {
		if (ref.current) setIcon(ref.current, name);
	}, [name]);
	return (
		<span
			ref={ref}
			className={className}
			aria-hidden={label ? undefined : true}
			aria-label={label}
			title={label}
		/>
	);
}

const STATUS_PRESENTATION: Record<
	SessionRuntimeStatus,
	{ icon: string; label: string }
> = {
	ready: { icon: "circle-check", label: "Ready" },
	busy: { icon: "loader-circle", label: "Working" },
	permission: { icon: "shield-alert", label: "Waiting for permission" },
	error: { icon: "circle-x", label: "Session error" },
	disconnected: { icon: "circle-off", label: "Disconnected" },
};

class RenameSessionModal extends Modal {
	constructor(
		app: AgentClientPlugin["app"],
		private readonly currentTitle: string,
		private readonly onSubmit: (name: string) => void | Promise<void>,
	) {
		super(app);
	}

	onOpen() {
		this.contentEl.empty();
		this.contentEl.createEl("h2", { text: "Rename session" });
		const input = this.contentEl.createEl("input", {
			type: "text",
			value: this.currentTitle,
			cls: "agent-client-session-rename-input",
			attr: { "aria-label": "Session name" },
		});
		const actions = this.contentEl.createDiv({
			cls: "agent-client-session-modal-actions",
		});
		const cancel = actions.createEl("button", { text: "Cancel" });
		const rename = actions.createEl("button", {
			text: "Rename",
			cls: "mod-cta",
		});
		const submit = () => {
			const value = input.value;
			if (!value.trim()) {
				new Notice("Session name cannot be empty");
				return;
			}
			this.close();
			void this.onSubmit(value);
		};
		cancel.addEventListener("click", () => this.close());
		rename.addEventListener("click", submit);
		input.addEventListener("keydown", (event) => {
			if (event.key === "Enter") submit();
		});
		input.focus();
		input.select();
	}

	onClose() {
		this.contentEl.empty();
	}
}

const SessionRow = React.memo(function SessionRow({
	item,
	plugin,
}: {
	item: SessionCatalogItem;
	plugin: AgentClientPlugin;
}) {
	const showMenu = useCallback(
		(position: { x: number; y: number }) => {
			const menu = new Menu();
			menu.addItem((menuItem) =>
				menuItem
					.setTitle("Open")
					.setIcon("arrow-up-right")
					.onClick(
						() => void plugin.openNavigatorSession(item.entryId),
					),
			);
			menu.addItem((menuItem) =>
				menuItem
					.setTitle("Reveal in file explorer")
					.setIcon("folder-search")
					.onClick(
						() => void plugin.revealNavigatorSession(item.entryId),
					),
			);
			menu.addSeparator();
			menu.addItem((menuItem) =>
				menuItem
					.setTitle("Rename")
					.setIcon("pencil")
					.onClick(() => {
						new RenameSessionModal(plugin.app, item.title, (name) =>
							plugin.renameNavigatorSession(item.entryId, name),
						).open();
					}),
			);
			menu.addItem((menuItem) =>
				menuItem
					.setTitle("Delete")
					.setIcon("trash-2")
					.onClick(
						() => void plugin.deleteNavigatorSession(item.entryId),
					),
			);
			menu.showAtPosition(position);
		},
		[item.entryId, item.title, plugin],
	);
	const open = useCallback(
		() => void plugin.openNavigatorSession(item.entryId),
		[item.entryId, plugin],
	);
	const status = item.runtimeStatus
		? STATUS_PRESENTATION[item.runtimeStatus]
		: null;

	return (
		<div
			className={`agent-client-navigator-session-row ${item.isSelected ? "is-selected" : ""}`}
			role="button"
			tabIndex={0}
			aria-current={item.isSelected ? "page" : undefined}
			onClick={open}
			onKeyDown={(event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					open();
				}
			}}
			onContextMenu={(event) => {
				event.preventDefault();
				showMenu({ x: event.clientX, y: event.clientY });
			}}
		>
			<span
				className="agent-client-navigator-session-title"
				title={item.title}
			>
				{item.title}
			</span>
			<span className="agent-client-navigator-status-slot">
				{status && (
					<ObsidianIcon
						name={status.icon}
						label={status.label}
						className={`agent-client-navigator-status is-${item.runtimeStatus}`}
					/>
				)}
			</span>
			<button
				type="button"
				className="agent-client-navigator-more clickable-icon"
				aria-label={`Actions for ${item.title}`}
				onClick={(event) => {
					event.stopPropagation();
					showMenu({ x: event.clientX, y: event.clientY });
				}}
			>
				<ObsidianIcon name="ellipsis" />
			</button>
		</div>
	);
});

function SessionManagerComponent({ plugin }: { plugin: AgentClientPlugin }) {
	const snapshot = useSyncExternalStore(
		plugin.sessionCatalog.subscribe,
		plugin.sessionCatalog.getSnapshot,
		plugin.sessionCatalog.getSnapshot,
	);
	const [searchOpen, setSearchOpen] = useState(false);
	const [query, setQuery] = useState("");
	const [showAllProjects, setShowAllProjects] = useState(false);
	const [showAllRecents, setShowAllRecents] = useState(false);
	const [collapsedProjects, setCollapsedProjects] = useState<Set<string>>(
		() => new Set(),
	);
	const searchRef = useRef<HTMLInputElement>(null);

	useEffect(() => {
		if (searchOpen) searchRef.current?.focus();
	}, [searchOpen]);

	const visible = useMemo(
		() =>
			getVisibleNavigatorItems(
				snapshot.projects,
				snapshot.recents,
				showAllProjects,
				showAllRecents,
			),
		[snapshot.projects, snapshot.recents, showAllProjects, showAllRecents],
	);
	const normalizedQuery = query.trim();
	const searchResults = useMemo(
		() =>
			searchSessionCatalog(
				snapshot.items,
				snapshot.projects,
				normalizedQuery,
			),
		[snapshot.items, snapshot.projects, normalizedQuery],
	);
	const refreshIssue = snapshot.issues.find(
		(issue) => issue.code !== "orphan_runtime",
	);

	return (
		<div className="agent-client-session-manager">
			<header className="agent-client-navigator-header">
				{searchOpen ? (
					<>
						<ObsidianIcon
							name="search"
							className="agent-client-navigator-search-leading"
						/>
						<input
							ref={searchRef}
							className="agent-client-navigator-search-input"
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Escape") {
									setQuery("");
									setSearchOpen(false);
								}
							}}
							placeholder="Search sessions"
							aria-label="Search sessions"
						/>
						<button
							type="button"
							className="agent-client-navigator-icon-button clickable-icon"
							aria-label="Close search"
							onClick={() => {
								setQuery("");
								setSearchOpen(false);
							}}
						>
							<ObsidianIcon name="x" />
						</button>
					</>
				) : (
					<>
						<h1>Harness</h1>
						<button
							type="button"
							className="agent-client-navigator-icon-button clickable-icon"
							aria-label="Search sessions"
							onClick={() => setSearchOpen(true)}
						>
							<ObsidianIcon name="search" />
						</button>
					</>
				)}
			</header>

			<button
				type="button"
				className="agent-client-navigator-new-session"
				onClick={() => void plugin.createSessionFile()}
			>
				<ObsidianIcon name="square-pen" />
				<span>New session</span>
			</button>

			{refreshIssue && (
				<div className="agent-client-navigator-issue" role="status">
					<span title={refreshIssue.message}>
						{refreshIssue.message}
					</span>
					<button
						type="button"
						onClick={() => void plugin.sessionCatalog.refresh()}
					>
						Retry
					</button>
				</div>
			)}

			<main className="agent-client-navigator-content">
				{snapshot.phase === "loading" &&
					snapshot.items.length === 0 && (
						<div
							className="agent-client-navigator-loading"
							aria-label="Loading sessions"
						>
							<span />
							<span />
							<span />
						</div>
					)}

				{searchOpen && normalizedQuery ? (
					<section aria-label="Search results">
						<div className="agent-client-navigator-section-title">
							Search results
						</div>
						{searchResults.map((item) => (
							<SessionRow
								key={item.entryId}
								item={item}
								plugin={plugin}
							/>
						))}
						{searchResults.length === 0 && (
							<div className="agent-client-session-manager-empty">
								No matching sessions
							</div>
						)}
					</section>
				) : (
					<>
						{snapshot.projects.length > 0 && (
							<section aria-label="Projects">
								<div className="agent-client-navigator-section-title">
									Projects
								</div>
								{visible.projects.map((project) => {
									const collapsed = collapsedProjects.has(
										project.cwd,
									);
									return (
										<div
											key={project.cwd}
											className="agent-client-navigator-project"
										>
											<button
												type="button"
												className="agent-client-navigator-project-row"
												aria-expanded={!collapsed}
												onClick={() =>
													setCollapsedProjects(
														(current) => {
															const next =
																new Set(
																	current,
																);
															if (
																next.has(
																	project.cwd,
																)
															)
																next.delete(
																	project.cwd,
																);
															else
																next.add(
																	project.cwd,
																);
															return next;
														},
													)
												}
											>
												<ObsidianIcon
													name={
														collapsed
															? "chevron-right"
															: "chevron-down"
													}
												/>
												<ObsidianIcon name="folder" />
												<span title={project.cwd}>
													{project.displayName}
												</span>
											</button>
											{!collapsed && (
												<div className="agent-client-navigator-project-sessions">
													{project.sessions.map(
														(item) => (
															<SessionRow
																key={
																	item.entryId
																}
																item={item}
																plugin={plugin}
															/>
														),
													)}
												</div>
											)}
										</div>
									);
								})}
								{visible.hasMoreProjects && (
									<button
										type="button"
										className="agent-client-navigator-show-more"
										onClick={() => setShowAllProjects(true)}
									>
										Show more
									</button>
								)}
							</section>
						)}

						{snapshot.recents.length > 0 && (
							<section aria-label="Recents">
								<div className="agent-client-navigator-section-title">
									Recents
								</div>
								{visible.recents.map((item) => (
									<SessionRow
										key={item.entryId}
										item={item}
										plugin={plugin}
									/>
								))}
								{visible.hasMoreRecents && (
									<button
										type="button"
										className="agent-client-navigator-show-more"
										onClick={() => setShowAllRecents(true)}
									>
										Show more
									</button>
								)}
							</section>
						)}
					</>
				)}

				{snapshot.phase !== "loading" &&
					snapshot.items.length === 0 &&
					!normalizedQuery && (
						<div className="agent-client-session-manager-empty">
							{snapshot.phase === "error"
								? "Sessions unavailable"
								: snapshot.issues.length > 0
									? "No available sessions"
									: "No sessions yet"}
						</div>
					)}
			</main>
		</div>
	);
}

export class SessionManagerView extends ItemView {
	private root: Root | null = null;

	constructor(
		leaf: WorkspaceLeaf,
		private readonly plugin: AgentClientPlugin,
	) {
		super(leaf);
		this.navigation = false;
	}

	getViewType() {
		return VIEW_TYPE_SESSION_MANAGER;
	}

	getDisplayText() {
		return "Harness";
	}

	getIcon() {
		return "panel-left";
	}

	onOpen() {
		const container = this.containerEl.children[1];
		container.empty();
		this.root = createRoot(container);
		this.root.render(<SessionManagerComponent plugin={this.plugin} />);
		return Promise.resolve();
	}

	async onClose() {
		this.root?.unmount();
		this.root = null;
	}
}
