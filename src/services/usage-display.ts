import type { SessionUsage } from "../types/session";

export type UsageTone = "normal" | "caution" | "warning" | "danger";

export interface UsageDisplay {
	percentage: number;
	tone: UsageTone;
	usedLabel: string;
	sizeLabel: string;
	ariaLabel: string;
	title: string;
}

export function formatTokenCount(tokens: number): string {
	if (!Number.isFinite(tokens) || tokens <= 0) return "0";
	if (tokens < 1000) return String(Math.round(tokens));
	const k = tokens / 1000;
	return k >= 100 ? `${Math.round(k)}K` : `${k.toFixed(1)}K`;
}

export function getUsageTone(percentage: number): UsageTone {
	if (percentage >= 90) return "danger";
	if (percentage >= 80) return "warning";
	if (percentage >= 70) return "caution";
	return "normal";
}

export function buildUsageDisplay(usage: SessionUsage): UsageDisplay {
	const rawPercentage =
		usage.size > 0 ? Math.round((usage.used / usage.size) * 100) : 0;
	const percentage = Math.max(0, Math.min(100, rawPercentage));
	const usedLabel = formatTokenCount(usage.used);
	const sizeLabel = formatTokenCount(usage.size);
	const tokenLabel = `${usedLabel} / ${sizeLabel} tokens`;
	const costLabel = usage.cost
		? `, ${usage.cost.amount.toFixed(2)} ${usage.cost.currency}`
		: "";
	const fullLabel = `${percentage}% context used (${tokenLabel}${costLabel})`;

	return {
		percentage,
		tone: getUsageTone(percentage),
		usedLabel,
		sizeLabel,
		ariaLabel: fullLabel,
		title: fullLabel,
	};
}
