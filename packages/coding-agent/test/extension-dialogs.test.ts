import type { TUI, TuiMouseEvent } from "@earendil-works/pi-tui";
import { afterEach, beforeAll, describe, expect, test, vi } from "vitest";
import { DialogBorder, ExtensionDialog } from "../src/modes/interactive/components/extension-dialog.ts";
import { ExtensionSelectorComponent } from "../src/modes/interactive/components/extension-selector.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

const fakeTui = { requestRender: () => {} } as unknown as TUI;

function plain(lines: string[]): string[] {
	return lines.map((line) => stripAnsi(line).trimEnd());
}

function selector(title: string, options: string[], timeout?: number) {
	return new ExtensionSelectorComponent(
		title,
		options,
		() => {},
		() => {},
		{ tui: fakeTui, timeout },
	);
}

function click(dialog: ExtensionDialog, x: number, y: number): void {
	dialog.handleMouse({
		type: "click",
		button: "left",
		x,
		y,
		screenX: x,
		screenY: y,
		width: 100,
		height: 2,
		shift: false,
		alt: false,
		ctrl: false,
	});
}

describe("extension dialogs", () => {
	beforeAll(() => initTheme("dark"));
	afterEach(() => vi.useRealTimers());

	test("frame a selector with rounded borders, a heading and marked options", () => {
		const lines = plain(selector("Deploy where?", ["production", "staging"]).render(60));

		expect(lines.slice(0, 7)).toEqual([
			` ╭${"─".repeat(56)}╮`,
			"",
			" ◈ Deploy where?",
			"",
			" ◆ production",
			" ◇ staging",
			"",
		]);
		expect(lines[7]).toMatch(/^ ↑↓ navigate {2}.+ select {2}.+ cancel$/);
		expect(lines.slice(8)).toEqual(["", ` ╰${"─".repeat(56)}╯`]);
	});

	test("use a wider gutter on wide screens", () => {
		expect(plain(selector("Pick", ["a"]).render(100))[0]).toBe(`   ╭${"─".repeat(92)}╮`);
	});

	test("move the selection marker with the keyboard", () => {
		const dialog = selector("Pick", ["a", "b"]);
		dialog.handleInput("j");

		expect(plain(dialog.render(60)).slice(4, 6)).toEqual([" ◇ a", " ◆ b"]);
	});

	test("show the heading's first line as the title and the rest as text", () => {
		const lines = plain(selector("Delete files?\nThis removes 3 files.", ["Yes", "No"]).render(60));

		expect(lines.slice(2, 4)).toEqual([" ◈ Delete files?", " This removes 3 files."]);
	});

	test("count down in the heading", () => {
		vi.useFakeTimers();
		const dialog = selector("Pick", ["a"], 3000);
		expect(plain(dialog.render(60))[2]).toBe(" ◈ Pick (3s)");

		vi.advanceTimersByTime(1000);
		expect(plain(dialog.render(60))[2]).toBe(" ◈ Pick (2s)");
		dialog.dispose();
	});

	test("show ten options of a long list around the selection", () => {
		const options = Array.from({ length: 30 }, (_, i) => `option ${i}`);
		const dialog = selector("Pick", options);
		for (let i = 0; i < 20; i++) dialog.handleInput("j");

		const lines = plain(dialog.render(60));
		expect(lines[4]).toBe(" ◇ option 11");
		expect(lines.slice(12, 15)).toEqual([" ◇ option 19", " ◆ option 20", " (21/30)"]);

		for (let i = 0; i < 10; i++) dialog.handleInput("k");
		expect(plain(dialog.render(60)).slice(4, 6)).toEqual([" ◆ option 10", " ◇ option 11"]);
	});

	test("pass clicks past the gutter to the content", () => {
		const events: TuiMouseEvent[] = [];
		const dialog = new ExtensionDialog();
		dialog.addChild(new DialogBorder("top"));
		dialog.addChild({
			render: () => ["content"],
			handleMouse: (event) => {
				events.push(event);
				return { handled: true };
			},
			invalidate: () => {},
		});

		click(dialog, 1, 1);
		click(dialog, 5, 1);

		expect(events.map(({ x, y, width }) => ({ x, y, width }))).toEqual([{ x: 2, y: 0, width: 94 }]);
	});
});
