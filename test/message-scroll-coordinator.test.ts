import { afterEach, describe, expect, it, vi } from "vitest";

import {
	createMessageScrollCoordinator,
	getVirtualMessageAnchorIndex,
	scheduleCoalescedAnimationFrame,
	type MessageScrollContainer,
} from "../src/ui/message-scroll-coordinator";

class FakeScrollContainer implements MessageScrollContainer {
	scrollTop = 0;
	scrollHeight = 1000;
	clientHeight = 200;
	readonly calls: ScrollToOptions[] = [];
	private listeners = new Set<EventListener>();

	scrollTo(options: ScrollToOptions): void {
		this.calls.push(options);
		if (typeof options.top === "number") this.scrollTop = options.top;
	}

	addEventListener(
		type: "scrollend",
		listener: EventListener,
	): void {
		if (type === "scrollend") this.listeners.add(listener);
	}

	removeEventListener(
		type: "scrollend",
		listener: EventListener,
	): void {
		if (type === "scrollend") this.listeners.delete(listener);
	}

	dispatchScrollEnd(): void {
		for (const listener of [...this.listeners]) {
			listener(new Event("scrollend"));
		}
	}

	get listenerCount(): number {
		return this.listeners.size;
	}
}

function createCoordinator(container: FakeScrollContainer) {
	return createMessageScrollCoordinator({
		getContainer: () => container,
		setTimer: (callback, delay) =>
			setTimeout(callback, delay) as unknown as number,
		clearTimer: (timer) => clearTimeout(timer),
	});
}

afterEach(() => {
	vi.useRealTimers();
});

describe("message scroll coordinator", () => {
	it("AC-0025-B-3: coalesces active updates to one callback per frame", () => {
		const frameRef = { current: null as number | null };
		const queued: Array<() => void> = [];
		const callback = vi.fn();
		const requestFrame = (next: () => void) => {
			queued.push(next);
			return queued.length;
		};

		scheduleCoalescedAnimationFrame(frameRef, requestFrame, callback);
		scheduleCoalescedAnimationFrame(frameRef, requestFrame, callback);
		scheduleCoalescedAnimationFrame(frameRef, requestFrame, callback);
		expect(queued).toHaveLength(1);

		queued.shift()?.();
		expect(callback).toHaveBeenCalledTimes(1);
		expect(frameRef.current).toBeNull();

		scheduleCoalescedAnimationFrame(frameRef, requestFrame, callback);
		expect(queued).toHaveLength(1);
	});

	it("AC-0025-N-2/B-4: derives the anchor from the actual scroll offset", () => {
		const offsets: number[] = [];
		const virtualizer = {
			getVirtualItemForOffset(offset: number) {
				offsets.push(offset);
				return { index: 17 };
			},
		};

		expect(getVirtualMessageAnchorIndex(virtualizer, 640, 48)).toBe(17);
		expect(offsets).toEqual([640]);
		expect(getVirtualMessageAnchorIndex(virtualizer, -10, 48)).toBe(17);
		expect(getVirtualMessageAnchorIndex(null, 0, 48)).toBe(0);
		expect(getVirtualMessageAnchorIndex(null, 30, 48)).toBe(47);
		expect(getVirtualMessageAnchorIndex(null, 30, 0)).toBe(0);
	});

	it("AC-0025-N-3/N-5: performs one primary and at most one correction", () => {
		const container = new FakeScrollContainer();
		const coordinator = createCoordinator(container);
		let offset = 600;
		let commits = 0;

		coordinator.coordinateSmoothMessageScroll({
			resolveOffset: () => offset,
			commitExact: () => commits++,
			isCurrent: () => true,
			reducedMotion: false,
		});
		expect(container.calls).toEqual([
			{ top: 600, behavior: "smooth" },
		]);

		offset = 640;
		container.dispatchScrollEnd();
		expect(container.calls).toHaveLength(2);
		expect(container.calls[1]).toEqual({
			top: 640,
			behavior: "smooth",
		});

		offset = 680;
		container.dispatchScrollEnd();
		expect(container.calls).toHaveLength(2);
		expect(commits).toBe(1);
		expect(container.listenerCount).toBe(0);
	});

	it("AC-0025-N-3/N-5: keeps one action identity through bounded timeouts", () => {
		vi.useFakeTimers();
		const container = new FakeScrollContainer();
		const coordinator = createCoordinator(container);
		let offset = 300;
		let commits = 0;

		coordinator.coordinateSmoothMessageScroll({
			resolveOffset: () => offset,
			commitExact: () => commits++,
			isCurrent: () => true,
			reducedMotion: false,
		});
		offset = 350;
		vi.advanceTimersByTime(1600);
		expect(container.calls).toHaveLength(2);
		expect(commits).toBe(0);

		vi.advanceTimersByTime(1600);
		expect(container.calls).toHaveLength(2);
		expect(commits).toBe(1);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("AC-0025-N-5: skips correction when live error is at most one pixel", () => {
		const container = new FakeScrollContainer();
		const coordinator = createCoordinator(container);
		let offset = 400;
		let commits = 0;

		coordinator.coordinateSmoothMessageScroll({
			resolveOffset: () => offset,
			commitExact: () => commits++,
			isCurrent: () => true,
			reducedMotion: false,
		});
		offset = 400.5;
		container.dispatchScrollEnd();

		expect(container.calls).toHaveLength(1);
		expect(commits).toBe(1);
	});

	it("AC-0025-B-5/F-2: lands immediately for reduced motion or invalid geometry", () => {
		const container = new FakeScrollContainer();
		const coordinator = createCoordinator(container);
		let commits = 0;

		coordinator.coordinateSmoothMessageScroll({
			resolveOffset: () => 800,
			commitExact: () => commits++,
			isCurrent: () => true,
			reducedMotion: true,
		});
		coordinator.coordinateSmoothMessageScroll({
			resolveOffset: () => Number.NaN,
			commitExact: () => commits++,
			isCurrent: () => true,
			reducedMotion: false,
		});

		expect(container.calls).toEqual([]);
		expect(commits).toBe(2);
		expect(container.listenerCount).toBe(0);
	});

	it("AC-0025-E-3: superseding and direct input cancel stale landing", () => {
		vi.useFakeTimers();
		const container = new FakeScrollContainer();
		const coordinator = createCoordinator(container);
		let firstCommits = 0;
		let secondCommits = 0;

		coordinator.coordinateSmoothMessageScroll({
			resolveOffset: () => 300,
			commitExact: () => firstCommits++,
			isCurrent: () => true,
			reducedMotion: false,
		});
		coordinator.coordinateSmoothMessageScroll({
			resolveOffset: () => 700,
			commitExact: () => secondCommits++,
			isCurrent: () => true,
			reducedMotion: false,
		});
		expect(container.listenerCount).toBe(1);

		coordinator.cancel();
		container.dispatchScrollEnd();
		vi.runAllTimers();
		expect(firstCommits).toBe(0);
		expect(secondCommits).toBe(0);
		expect(container.listenerCount).toBe(0);
		expect(vi.getTimerCount()).toBe(0);
	});

	it("AC-0025-E-3/F-1: drops an invalid target and recovers", () => {
		const container = new FakeScrollContainer();
		const coordinator = createCoordinator(container);
		let current = true;
		let staleCommits = 0;
		let recoveredCommits = 0;

		coordinator.coordinateSmoothMessageScroll({
			resolveOffset: () => 300,
			commitExact: () => staleCommits++,
			isCurrent: () => current,
			reducedMotion: false,
		});
		current = false;
		coordinator.cancelIfTargetChanged();
		expect(container.listenerCount).toBe(0);

		coordinator.coordinateSmoothMessageScroll({
			resolveOffset: () => 500,
			commitExact: () => recoveredCommits++,
			isCurrent: () => true,
			reducedMotion: false,
		});
		container.dispatchScrollEnd();

		expect(staleCommits).toBe(0);
		expect(recoveredCommits).toBe(1);
	});

	it("AC-0025-E-3: removes listeners from the action's original container", () => {
		const first = new FakeScrollContainer();
		const second = new FakeScrollContainer();
		let currentContainer: FakeScrollContainer = first;
		const coordinator = createMessageScrollCoordinator({
			getContainer: () => currentContainer,
			setTimer: (callback, delay) =>
				setTimeout(callback, delay) as unknown as number,
			clearTimer: (timer) => clearTimeout(timer),
		});

		coordinator.coordinateSmoothMessageScroll({
			resolveOffset: () => 300,
			commitExact: () => undefined,
			isCurrent: () => true,
			reducedMotion: false,
		});
		expect(first.listenerCount).toBe(1);

		currentContainer = second;
		coordinator.cancel();
		expect(first.listenerCount).toBe(0);
		expect(second.listenerCount).toBe(0);
	});
});
