import * as React from "react";
const { useRef, useEffect, useCallback, useMemo, useState } = React;
import { setIcon, Menu } from "obsidian";

import {
	flattenConfigSelectOptions,
	type SessionModeState,
	type SessionUsage,
	type SessionConfigOption,
	type SessionConfigSelectGroup,
} from "../types/session";
import { buildUsageDisplay } from "../services/usage-display";

// ============================================================================
// ToolbarDropdown — themed dropdown using Obsidian's Menu
// ============================================================================

interface ToolbarDropdownItem {
	value: string;
	label: string;
	groupName?: string;
}

interface ToolbarDropdownProps {
	label: string;
	title: string;
	items: ToolbarDropdownItem[];
	currentValue: string | undefined;
	onChange: (value: string) => void;
	className?: string;
}

function buildSelectItems(option: SessionConfigOption): ToolbarDropdownItem[] {
	if (option.type !== "select") return [];
	const flatOptions = flattenConfigSelectOptions(option.options);
	const isGrouped = option.options.length > 0 && "group" in option.options[0];

	if (!isGrouped) {
		return flatOptions.map((opt) => ({
			value: opt.value,
			label: opt.name,
		}));
	}

	const items: ToolbarDropdownItem[] = [];
	for (const group of option.options as SessionConfigSelectGroup[]) {
		for (const opt of group.options) {
			items.push({
				value: opt.value,
				label: `${group.name} / ${opt.name}`,
				groupName: group.name,
			});
		}
	}
	return items;
}

function showConfigOptionMenu({
	event,
	option,
	onChange,
	emptyTitle,
}: {
	event: React.MouseEvent<HTMLElement>;
	option: SessionConfigOption | null | undefined;
	onChange?: (configId: string, value: string) => void;
	emptyTitle: string;
}): void {
	const menu = new Menu();

	if (!option || option.type !== "select") {
		menu.addItem((menuItem) => {
			menuItem.setTitle(emptyTitle).setIsLabel(true);
		});
		menu.addItem((menuItem) => {
			menuItem.setTitle("No model options from this backend");
		});
		menu.showAtMouseEvent(event.nativeEvent);
		return;
	}

	const items = buildSelectItems(option);
	menu.addItem((menuItem) => {
		menuItem.setTitle(option.description ?? option.name).setIsLabel(true);
	});

	let lastGroupName: string | undefined;
	for (const item of items) {
		if (
			item.groupName &&
			item.groupName !== lastGroupName &&
			lastGroupName !== undefined
		) {
			menu.addSeparator();
		}
		lastGroupName = item.groupName;

		menu.addItem((menuItem) => {
			menuItem
				.setTitle(item.label)
				.setChecked(item.value === option.currentValue)
				.onClick(() => {
					onChange?.(option.id, item.value);
				});
		});
	}

	menu.showAtMouseEvent(event.nativeEvent);
}

/**
 * Themed dropdown trigger. Uses Obsidian's Menu instead of a native <select>
 * so the open state respects Obsidian theme tokens, supports keyboard nav,
 * and can be positioned above the trigger to avoid covering the input.
 */
function ToolbarDropdown({
	label,
	title,
	items,
	currentValue,
	onChange,
	className,
}: ToolbarDropdownProps) {
	const buttonRef = useRef<HTMLButtonElement>(null);
	const chevronRef = useRef<HTMLSpanElement>(null);

	useEffect(() => {
		if (chevronRef.current) {
			setIcon(chevronRef.current, "chevron-down");
		}
	}, []);

	const handleClick = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			e.preventDefault();
			e.stopPropagation();

			const menu = new Menu();

			menu.addItem((menuItem) => {
				menuItem.setTitle(title).setIsLabel(true);
			});

			let lastGroupName: string | undefined;
			for (const item of items) {
				if (
					item.groupName &&
					item.groupName !== lastGroupName &&
					lastGroupName !== undefined
				) {
					menu.addSeparator();
				}
				lastGroupName = item.groupName;

				menu.addItem((menuItem) => {
					menuItem
						.setTitle(item.label)
						.setChecked(item.value === currentValue)
						.onClick(() => {
							onChange(item.value);
						});
				});
			}

			menu.showAtMouseEvent(e.nativeEvent);
			buttonRef.current?.blur();
		},
		[items, currentValue, onChange],
	);

	const wrapperClass = `agent-client-toolbar-dropdown${className ? ` ${className}` : ""}`;

	return (
		<button
			ref={buttonRef}
			type="button"
			className={wrapperClass}
			title={title}
			onClick={handleClick}
		>
			<span className="agent-client-toolbar-dropdown-label-area">
				{items.map((item) => (
					<span
						key={item.value}
						className="agent-client-toolbar-dropdown-sizer"
					>
						{item.label}
					</span>
				))}
				<span className="agent-client-toolbar-dropdown-label">
					{label}
				</span>
			</span>
			<span
				ref={chevronRef}
				className="agent-client-toolbar-dropdown-chevron"
				aria-hidden="true"
			/>
		</button>
	);
}

// ============================================================================
// Utility Functions
// ============================================================================

// ============================================================================
// InputToolbar
// ============================================================================

export interface InputToolbarProps {
	isSending: boolean;
	isButtonDisabled: boolean;
	hasContent: boolean;
	onSendOrStop: () => void;
	modes?: SessionModeState;
	onModeChange?: (modeId: string) => void;
	configOptions?: SessionConfigOption[];
	onConfigOptionChange?: (configId: string, value: string) => void;
	onPrepareSessionConfig?: () => Promise<SessionConfigOption[] | undefined>;
	usage?: SessionUsage;
	isSessionReady: boolean;
}

export function InputToolbar({
	isSending,
	isButtonDisabled,
	hasContent,
	onSendOrStop,
	modes,
	onModeChange,
	configOptions,
	onConfigOptionChange,
	onPrepareSessionConfig,
	usage,
	isSessionReady,
}: InputToolbarProps) {
	const addButtonRef = useRef<HTMLButtonElement>(null);
	const modelButtonRef = useRef<HTMLButtonElement>(null);
	const modelChevronRef = useRef<HTMLSpanElement>(null);
	const sendButtonRef = useRef<HTMLButtonElement>(null);
	const [isPreparingConfig, setIsPreparingConfig] = useState(false);
	const usageDisplay = useMemo(
		() => (usage ? buildUsageDisplay(usage) : null),
		[usage],
	);

	useEffect(() => {
		if (addButtonRef.current) {
			setIcon(addButtonRef.current, "plus");
		}
	}, []);

	useEffect(() => {
		if (modelChevronRef.current) {
			setIcon(modelChevronRef.current, "chevron-down");
		}
	}, [isPreparingConfig]);

	const handleAddResource = useCallback(
		(e: React.MouseEvent<HTMLButtonElement>) => {
			e.preventDefault();
			e.stopPropagation();

			const menu = new Menu();
			menu.addItem((item) => {
				item.setTitle("Add").setIsLabel(true);
			});
			menu.addItem((item) => {
				item.setTitle("Files and folders")
					.setIcon("paperclip")
					.onClick(() => {});
			});
			menu.addItem((item) => {
				item.setTitle("Current note")
					.setIcon("file-text")
					.onClick(() => {});
			});
			menu.addItem((item) => {
				item.setTitle("Vault search")
					.setIcon("search")
					.onClick(() => {});
			});
			menu.showAtMouseEvent(e.nativeEvent);
			addButtonRef.current?.blur();
		},
		[],
	);

	const updateIconColor = useCallback(
		(svg: SVGElement) => {
			svg.classList.remove(
				"agent-client-icon-sending",
				"agent-client-icon-active",
				"agent-client-icon-inactive",
			);

			if (isSending) {
				svg.classList.add("agent-client-icon-sending");
			} else {
				svg.classList.add(
					hasContent
						? "agent-client-icon-active"
						: "agent-client-icon-inactive",
				);
			}
		},
		[isSending, hasContent],
	);

	useEffect(() => {
		if (sendButtonRef.current) {
			const iconName = isSending ? "square" : "send-horizontal";
			setIcon(sendButtonRef.current, iconName);
			const svg = sendButtonRef.current.querySelector("svg");
			if (svg) {
				updateIconColor(svg);
			}
		}
	}, [isSending, updateIconColor]);

	useEffect(() => {
		if (sendButtonRef.current) {
			const svg = sendButtonRef.current.querySelector("svg");
			if (svg) {
				updateIconColor(svg);
			}
		}
	}, [updateIconColor]);

	// ----- Build dropdown item lists (memoized) -----

	const modeItems = useMemo<ToolbarDropdownItem[]>(() => {
		if (!modes?.availableModes) return [];
		return modes.availableModes.map((m) => ({
			value: m.id,
			label: m.name,
		}));
	}, [modes]);

	const currentModeLabel = useMemo(() => {
		const id = modes?.currentModeId;
		return modes?.availableModes?.find((m) => m.id === id)?.name ?? "Mode";
	}, [modes]);

	const handlePrepareModelConfig = useCallback(
		async (e: React.MouseEvent<HTMLButtonElement>) => {
			e.preventDefault();
			e.stopPropagation();
			if (!onPrepareSessionConfig || isPreparingConfig) return;

			setIsPreparingConfig(true);
			try {
				const preparedOptions = await onPrepareSessionConfig();
				const modelOption = preparedOptions?.find(
					(option) =>
						option.type === "select" &&
						option.category === "model" &&
						flattenConfigSelectOptions(option.options).length > 1,
				);
				showConfigOptionMenu({
					event: e,
					option: modelOption,
					onChange: onConfigOptionChange,
					emptyTitle: "Model",
				});
			} finally {
				setIsPreparingConfig(false);
				modelButtonRef.current?.blur();
			}
		},
		[isPreparingConfig, onConfigOptionChange, onPrepareSessionConfig],
	);

	// ----- Render -----

	return (
		<div className="agent-client-chat-input-actions">
			<div className="agent-client-chat-input-actions-left">
				<button
					ref={addButtonRef}
					type="button"
					className="clickable-icon agent-client-resource-add-button"
					title="Add context"
					aria-label="Add context"
					onClick={handleAddResource}
				/>
			</div>

			<div className="agent-client-chat-input-actions-right">
				{usageDisplay && (
					<span
						className={`agent-client-usage-indicator agent-client-usage-${usageDisplay.tone}`}
						aria-label={usageDisplay.ariaLabel}
						title={usageDisplay.title}
					>
						<svg
							className="agent-client-usage-ring"
							viewBox="0 0 20 20"
							aria-hidden="true"
						>
							<circle
								className="agent-client-usage-ring-track"
								cx="10"
								cy="10"
								r="7"
							/>
							<circle
								className="agent-client-usage-ring-progress"
								cx="10"
								cy="10"
								r="7"
								strokeDasharray={`${(usageDisplay.percentage * 0.4398).toFixed(2)} 43.98`}
							/>
						</svg>
						<span className="agent-client-usage-label">
							{usageDisplay.percentage}%
						</span>
					</span>
				)}

				{/* Config Options (supersedes legacy mode/model selectors) */}
				{configOptions && configOptions.length > 0 ? (
					configOptions.map((option) => {
						// boolean options (ACP 0.28+) are carried as data but
						// not yet rendered; only select options get a dropdown.
						if (option.type !== "select") return null;
						const flatOptions = flattenConfigSelectOptions(
							option.options,
						);
						if (flatOptions.length <= 1) return null;
						const items = buildSelectItems(option);

						const currentItem = items.find(
							(it) => it.value === option.currentValue,
						);
						const label = currentItem?.label ?? option.name;
						const title = option.description ?? option.name;

						return (
							<ToolbarDropdown
								key={option.id}
								label={label}
								title={title}
								items={items}
								currentValue={option.currentValue}
								onChange={(value) => {
									onConfigOptionChange?.(option.id, value);
								}}
								className={
									option.category
										? `agent-client-config-selector-${option.category}`
										: undefined
								}
							/>
						);
					})
				) : (
					<>
						{modes &&
							modes.availableModes.length > 1 &&
							onModeChange && (
								<ToolbarDropdown
									label={currentModeLabel}
									title={
										modes.availableModes.find(
											(m) => m.id === modes.currentModeId,
										)?.description ?? "Select mode"
									}
									items={modeItems}
									currentValue={
										modes.currentModeId ?? undefined
									}
									onChange={onModeChange}
								/>
							)}
						{!configOptions?.length && onPrepareSessionConfig && (
							<button
								ref={modelButtonRef}
								type="button"
								className="agent-client-toolbar-dropdown agent-client-config-selector-model agent-client-config-selector-pending"
								title="Load model options"
								onClick={(event) => {
									void handlePrepareModelConfig(event);
								}}
								disabled={isPreparingConfig}
							>
								<span className="agent-client-toolbar-dropdown-label-area">
									<span className="agent-client-toolbar-dropdown-label">
										{isPreparingConfig
											? "Loading model..."
											: "Model"}
									</span>
								</span>
								<span
									ref={modelChevronRef}
									className="agent-client-toolbar-dropdown-chevron"
									aria-hidden="true"
								/>
							</button>
						)}
					</>
				)}

				{/* Send/Stop Button */}
				<button
					ref={sendButtonRef}
					type="button"
					onClick={onSendOrStop}
					disabled={isButtonDisabled}
					className={`agent-client-chat-send-button ${isSending ? "sending" : ""} ${isButtonDisabled ? "agent-client-disabled" : ""}`}
					title={
						!isSessionReady
							? "Connecting..."
							: isSending
								? "Stop generation"
								: "Send message"
					}
				></button>
			</div>
		</div>
	);
}
