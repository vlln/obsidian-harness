import * as React from "react";
import { setTooltip } from "obsidian";

import type { TurnNavigationItem } from "../services/turn-navigation";

interface TurnNavigatorProps {
	items: readonly TurnNavigationItem[];
	activeMessageId: string | null;
	onNavigate: (item: TurnNavigationItem) => void;
}

export const TurnNavigator = React.memo(function TurnNavigator({
	items,
	activeMessageId,
	onNavigate,
}: TurnNavigatorProps) {
	if (items.length === 0) return null;
	return (
		<nav
			className="agent-client-turn-navigator"
			aria-label="Conversation turns"
		>
			{items.map((item) => (
				<div
					className="agent-client-turn-node-wrap"
					key={item.messageId}
				>
					<button
						type="button"
						className={`agent-client-turn-node ${
							item.messageId === activeMessageId
								? "is-active"
								: ""
						}`}
						aria-label={`Turn ${item.ordinal}: ${item.preview}`}
						aria-current={
							item.messageId === activeMessageId
								? "step"
								: undefined
						}
						ref={(element) => {
							if (element) {
								setTooltip(element, item.preview, {
									placement: "right",
								});
							}
						}}
						onClick={() => onNavigate(item)}
					>
						<span aria-hidden="true" />
					</button>
				</div>
			))}
		</nav>
	);
});
