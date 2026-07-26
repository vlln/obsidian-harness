import { describe, expect, it, vi } from "vitest";

import { SessionRuntimeRegistry } from "../src/services/view-registry";

describe("SessionRuntimeRegistry", () => {
	it("publishes one merged status per entry with stable snapshots", () => {
		const registry = new SessionRuntimeRegistry();
		const listener = vi.fn();
		registry.subscribe(listener);

		const initial = registry.getSnapshot();
		registry.setStatus("entry-1", "view-1", "ready");
		const ready = registry.getSnapshot();

		expect(ready).not.toBe(initial);
		expect(ready.statuses).toEqual({ "entry-1": "ready" });
		expect(registry.getSnapshot()).toBe(ready);
		expect(listener).toHaveBeenCalledTimes(1);

		registry.setStatus("entry-1", "view-1", "ready");
		expect(registry.getSnapshot()).toBe(ready);
		expect(listener).toHaveBeenCalledTimes(1);
	});

	it("merges multiple views using the user-attention priority", () => {
		const registry = new SessionRuntimeRegistry();
		registry.setStatus("entry-1", "ready-view", "ready");
		registry.setStatus("entry-1", "busy-view", "busy");
		registry.setStatus("entry-1", "error-view", "error");
		registry.setStatus("entry-1", "permission-view", "permission");

		expect(registry.getSnapshot().statuses["entry-1"]).toBe(
			"permission",
		);
		registry.remove("entry-1", "permission-view");
		expect(registry.getSnapshot().statuses["entry-1"]).toBe("error");
		registry.remove("entry-1", "error-view");
		expect(registry.getSnapshot().statuses["entry-1"]).toBe("busy");
		registry.remove("entry-1", "busy-view");
		expect(registry.getSnapshot().statuses["entry-1"]).toBe("ready");
		registry.remove("entry-1", "ready-view");
		expect(registry.getSnapshot().statuses["entry-1"]).toBeUndefined();
	});

	it("keeps entries independent and removes registrations idempotently", () => {
		const registry = new SessionRuntimeRegistry();
		registry.setStatus("entry-1", "view-1", "disconnected");
		registry.setStatus("entry-2", "view-2", "busy");

		registry.remove("entry-1", "missing-view");
		expect(registry.getSnapshot().statuses).toEqual({
			"entry-1": "disconnected",
			"entry-2": "busy",
		});
		registry.remove("entry-1", "view-1");
		expect(registry.getSnapshot().statuses).toEqual({
			"entry-2": "busy",
		});
	});

	it("clears runtime state and subscribers on plugin unload", () => {
		const registry = new SessionRuntimeRegistry();
		const listener = vi.fn();
		registry.subscribe(listener);
		registry.setStatus("entry-1", "view-1", "ready");

		registry.clear();
		expect(registry.getSnapshot().statuses).toEqual({});
		registry.setStatus("entry-2", "view-2", "busy");
		expect(listener).toHaveBeenCalledTimes(1);
	});
});
