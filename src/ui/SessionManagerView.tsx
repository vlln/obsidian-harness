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

import type HarnessPlugin from "../plugin";
import {
	getVisibleNavigatorItems,
	searchSessionCatalog,
} from "../services/session-navigator";
import type {
	SessionCatalogItem,
	SessionProjectGroup,
	SessionRuntimeStatus,
} from "../types/session-catalog";

export const VIEW_TYPE_SESSION_MANAGER = "harness-session-manager";

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

interface MenuPosition {
	x: number;
	y: number;
}

function getMenuPosition(event: React.MouseEvent<HTMLElement>): MenuPosition {
	if (event.clientX || event.clientY) {
		return { x: event.clientX, y: event.clientY };
	}
	const rect = event.currentTarget.getBoundingClientRect();
	return { x: rect.right, y: rect.bottom };
}

function restoreMenuFocus(menu: Menu, target: HTMLElement | null): void {
	menu.onHide(() => {
		window.requestAnimationFrame(() => {
			if (target?.isConnected) target.focus();
		});
	});
}

class RenameSessionModal extends Modal {
	constructor(
		app: HarnessPlugin["app"],
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
			cls: "harness-session-rename-input",
			attr: { "aria-label": "Session name" },
		});
		const actions = this.contentEl.createDiv({
			cls: "harness-session-modal-actions",
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
	plugin: HarnessPlugin;
}) {
	const moreButtonRef = useRef<HTMLButtonElement>(null);
	const showMenu = useCallback(
		(position: MenuPosition, focusTarget: HTMLElement | null) => {
			const menu = new Menu().setUseNativeMenu(false);
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
			restoreMenuFocus(menu, focusTarget);
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
			className={`harness-navigator-session-row ${item.isSelected ? "is-selected" : ""}`}
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
				showMenu(getMenuPosition(event), moreButtonRef.current);
			}}
		>
			<span
				className="harness-navigator-session-title"
				title={item.title}
			>
				{item.title}
			</span>
			<span className="harness-navigator-status-slot">
				{status && (
					<ObsidianIcon
						name={status.icon}
						label={status.label}
						className={`harness-navigator-status is-${item.runtimeStatus}`}
					/>
				)}
			</span>
			<button
				ref={moreButtonRef}
				type="button"
				className="harness-navigator-more clickable-icon"
				aria-label={`Actions for ${item.title}`}
				onClick={(event) => {
					event.stopPropagation();
					showMenu(getMenuPosition(event), event.currentTarget);
				}}
			>
				<ObsidianIcon name="ellipsis" />
			</button>
		</div>
	);
});

const ProjectRow = React.memo(function ProjectRow({
	project,
	collapsed,
	onToggle,
	plugin,
}: {
	project: SessionProjectGroup;
	collapsed: boolean;
	onToggle: () => void;
	plugin: HarnessPlugin;
}) {
	const moreButtonRef = useRef<HTMLButtonElement>(null);
	const showMenu = useCallback(
		(position: MenuPosition, focusTarget: HTMLElement | null) => {
			const menu = new Menu().setUseNativeMenu(false);
			menu.addItem((menuItem) =>
				menuItem
					.setTitle("New session here")
					.setIcon("square-pen")
					.onClick(
						() =>
							void plugin.createNavigatorSessionInProject(
								project.cwd,
							),
					),
			);
			menu.addItem((menuItem) =>
				menuItem
					.setTitle("Open in system file manager")
					.setIcon("external-link")
					.onClick(
						() =>
							void plugin.openNavigatorProjectDirectory(
								project.cwd,
							),
					),
			);
			menu.addItem((menuItem) =>
				menuItem
					.setTitle("Copy path")
					.setIcon("copy")
					.onClick(
						() => void plugin.copyNavigatorProjectPath(project.cwd),
					),
			);
			restoreMenuFocus(menu, focusTarget);
			menu.showAtPosition(position);
		},
		[plugin, project.cwd],
	);

	return (
		<div className="harness-navigator-project">
			<div
				className="harness-navigator-project-row-shell"
				onContextMenu={(event) => {
					event.preventDefault();
					showMenu(getMenuPosition(event), moreButtonRef.current);
				}}
			>
				<button
					type="button"
					className="harness-navigator-project-row"
					aria-expanded={!collapsed}
					onClick={onToggle}
				>
					<ObsidianIcon
						name={collapsed ? "chevron-right" : "chevron-down"}
					/>
					<ObsidianIcon name="folder" />
					<span title={project.cwd}>{project.displayName}</span>
				</button>
				<button
					ref={moreButtonRef}
					type="button"
					className="harness-navigator-more clickable-icon"
					aria-label={`Actions for ${project.displayName}`}
					onClick={(event) => {
						event.stopPropagation();
						showMenu(getMenuPosition(event), event.currentTarget);
					}}
				>
					<ObsidianIcon name="ellipsis" />
				</button>
			</div>
			{!collapsed && (
				<div className="harness-navigator-project-sessions">
					{project.sessions.map((item) => (
						<SessionRow
							key={item.entryId}
							item={item}
							plugin={plugin}
						/>
					))}
				</div>
			)}
		</div>
	);
});

function SessionManagerComponent({ plugin }: { plugin: HarnessPlugin }) {
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
		<div className="harness-session-manager">
			<header className="harness-navigator-header">
				{searchOpen ? (
					<>
						<ObsidianIcon
							name="search"
							className="harness-navigator-search-leading"
						/>
						<input
							ref={searchRef}
							className="harness-navigator-search-input"
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
							className="harness-navigator-icon-button clickable-icon"
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
							className="harness-navigator-icon-button clickable-icon"
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
				className="harness-navigator-new-session"
				onClick={() => plugin.openSessionCreationModal()}
			>
				<ObsidianIcon name="square-pen" />
				<span>New session</span>
			</button>

			{refreshIssue && (
				<div className="harness-navigator-issue" role="status">
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

			<main className="harness-navigator-content">
				{snapshot.phase === "loading" &&
					snapshot.items.length === 0 && (
						<div
							className="harness-navigator-loading"
							aria-label="Loading sessions"
						>
							<span />
							<span />
							<span />
						</div>
					)}

				{searchOpen && normalizedQuery ? (
					<section aria-label="Search results">
						<div className="harness-navigator-section-title">
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
							<div className="harness-session-manager-empty">
								No matching sessions
							</div>
						)}
					</section>
				) : (
					<>
						{snapshot.projects.length > 0 && (
							<section aria-label="Projects">
								<div className="harness-navigator-section-title">
									Projects
								</div>
								{visible.projects.map((project) => {
									const collapsed = collapsedProjects.has(
										project.cwd,
									);
									return (
										<ProjectRow
											key={project.cwd}
											project={project}
											collapsed={collapsed}
											plugin={plugin}
											onToggle={() =>
												setCollapsedProjects(
													(current) => {
														const next = new Set(
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
										/>
									);
								})}
								{visible.hasMoreProjects && (
									<button
										type="button"
										className="harness-navigator-show-more"
										onClick={() => setShowAllProjects(true)}
									>
										Show more
									</button>
								)}
							</section>
						)}

						{snapshot.recents.length > 0 && (
							<section aria-label="Recents">
								<div className="harness-navigator-section-title">
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
										className="harness-navigator-show-more"
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
						<div className="harness-session-manager-empty">
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
		private readonly plugin: HarnessPlugin,
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
