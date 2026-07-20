import { describe, expect, it } from "vitest";

import {
	buildUsageDisplay,
	formatTokenCount,
	getUsageTone,
} from "../src/services/usage-display";

describe("usage display helpers", () => {
	it("formats token counts compactly", () => {
		expect(formatTokenCount(999)).toBe("999");
		expect(formatTokenCount(1250)).toBe("1.3K");
		expect(formatTokenCount(200000)).toBe("200K");
		expect(formatTokenCount(-1)).toBe("0");
	});

	it("maps usage percentage to tones", () => {
		expect(getUsageTone(69)).toBe("normal");
		expect(getUsageTone(70)).toBe("caution");
		expect(getUsageTone(80)).toBe("warning");
		expect(getUsageTone(90)).toBe("danger");
	});

	it("builds an accessible label with clamped percentage", () => {
		const display = buildUsageDisplay({
			used: 120,
			size: 100,
			cost: { amount: 0.25, currency: "USD" },
		});
		expect(display.percentage).toBe(100);
		expect(display.tone).toBe("danger");
		expect(display.ariaLabel).toBe(
			"100% context used (120 / 100 tokens, 0.25 USD)",
		);
	});
});
