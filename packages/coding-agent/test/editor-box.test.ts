import { stripTerminalSequences, type TUI, visibleWidth } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { KeybindingsManager } from "../src/core/keybindings.ts";
import { CustomEditor } from "../src/modes/interactive/components/custom-editor.ts";
import { renderEditorBadges } from "../src/modes/interactive/components/editor-badges.ts";
import { ResponseTimer } from "../src/modes/interactive/response-timer.ts";
import { getEditorTheme, initTheme } from "../src/modes/interactive/theme/theme.ts";

function createEditor(rows = 20): CustomEditor {
	const tui = { requestRender: vi.fn(), terminal: { rows } } as unknown as TUI;
	return new CustomEditor(tui, getEditorTheme(), KeybindingsManager.create());
}

beforeAll(() => initTheme("dark"));

describe("editor box", () => {
	it("frames the text with a prompt and rounded corners", () => {
		const editor = createEditor();
		editor.setText("hello");

		const lines = editor.render(30).map(stripTerminalSequences);

		expect(lines[0]).toBe(`╭${"─".repeat(28)}╮`);
		expect(lines[1]).toMatch(/^│ ◆ hello +│$/);
		expect(lines[2]).toBe(`╰${"─".repeat(28)}╯`);
		for (const line of lines) expect(visibleWidth(line)).toBe(30);
	});

	it("puts badges in the top border within the budget it reports", () => {
		const editor = createEditor();
		const budgets: number[] = [];
		editor.badges = (budget) => {
			budgets.push(budget);
			return "plan mode";
		};

		const top = stripTerminalSequences(editor.render(30)[0]!);

		expect(budgets).toEqual([22]);
		expect(top).toBe(`╭${"─".repeat(15)} plan mode ──╮`);
		expect(visibleWidth(top)).toBe(30);
	});

	it("grows to 40% of the terminal before scrolling", () => {
		const editor = createEditor(20);
		editor.setText(Array.from({ length: 12 }, (_, index) => `line ${index}`).join("\n"));

		const lines = editor.render(40).map(stripTerminalSequences);

		expect(lines).toHaveLength(10);
		expect(lines[0]).toContain("↑ 4 more");
	});

	it("places the cursor where a click lands inside the frame", () => {
		const editor = createEditor();
		editor.setText("hello world");
		editor.render(30);

		editor.handleMouse({ type: "click", button: "left", x: 6, y: 1, width: 30 } as never);

		expect(editor.getCursor()).toEqual({ line: 0, col: 2 });
	});

	it("drops the frame in very narrow terminals", () => {
		const editor = createEditor();

		expect(stripTerminalSequences(editor.render(8)[0]!)).toBe("─".repeat(8));
	});
});

describe("editor badges", () => {
	const parts = { response: "29.8s", statuses: ["learn mode"], branch: "main", changes: 15 };

	it("shows the response time, statuses and branch when they fit", () => {
		expect(stripTerminalSequences(renderEditorBadges(parts, 80))).toBe(" 29.8s    learn mode ❯ ⎇ main *15");
	});

	it("drops the change count, then the response time, then the branch as room shrinks", () => {
		const widths = [30, 25, 22, 12].map((budget) => stripTerminalSequences(renderEditorBadges(parts, budget)));

		expect(widths).toEqual([" 29.8s    learn mode ❯ ⎇ main", "learn mode ❯ ⎇ main *15", "learn mode", "learn mode"]);
		expect(renderEditorBadges(parts, 5)).toBe("");
	});

	it("leaves out a clean branch's count and a missing branch", () => {
		expect(stripTerminalSequences(renderEditorBadges({ ...parts, changes: 0 }, 80))).toBe(
			" 29.8s    learn mode ❯ ⎇ main",
		);
		expect(stripTerminalSequences(renderEditorBadges({ ...parts, branch: null }, 80))).toBe(" 29.8s    learn mode");
	});
});

describe("response timer", () => {
	it("counts while running and keeps the last completed duration", () => {
		const timer = new ResponseTimer();
		expect(timer.text(0)).toBeUndefined();

		timer.start(1000);
		expect(timer.text(3500)).toBe("2.5s");
		timer.finish(5000, true);
		expect(timer.text(99_000)).toBe("4.0s");

		timer.start(10_000);
		timer.finish(11_000, false);
		expect(timer.text(99_000)).toBe("4.0s");

		timer.reset();
		expect(timer.text(99_000)).toBeUndefined();
	});
});
