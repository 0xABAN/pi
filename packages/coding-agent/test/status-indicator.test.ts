import type { TUI } from "@earendil-works/pi-tui";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
	IdleStatus,
	RetryStatusIndicator,
	WorkingStatusIndicator,
} from "../src/modes/interactive/components/status-indicator.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";

describe("status indicators", () => {
	afterEach(() => {
		vi.useRealTimers();
	});

	it("keeps idle status at the same height as standalone status indicators", () => {
		initTheme("dark");
		const idleStatus = new IdleStatus();

		const lines = idleStatus.render(20);
		expect(lines).toEqual([" ".repeat(20)]);

		const indicator = new WorkingStatusIndicator({ requestRender: vi.fn() } as unknown as TUI, "Working");
		expect(indicator.render(20)).toHaveLength(lines.length);
		indicator.dispose();
	});

	it("colors the working line's spinner and message", () => {
		initTheme("dark");
		const indicator = new WorkingStatusIndicator({ requestRender: vi.fn() } as unknown as TUI, "Working");

		const line = indicator.render(20)[0]!;
		expect(line).toContain(theme.getFgAnsi("accent"));
		expect(line).toContain(theme.getFgAnsi("muted"));
		indicator.dispose();
	});

	it("disposes retry countdown updates", () => {
		initTheme("dark");
		vi.useFakeTimers();
		const requestRender = vi.fn();
		const tui = { requestRender } as unknown as TUI;
		const indicator = new RetryStatusIndicator(tui, 1, 3, 1000);
		const callsBeforeDispose = requestRender.mock.calls.length;

		indicator.dispose();
		vi.advanceTimersByTime(2000);

		expect(requestRender).toHaveBeenCalledTimes(callsBeforeDispose);
	});
});
