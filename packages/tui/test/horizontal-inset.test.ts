import assert from "node:assert";
import { describe, it } from "node:test";
import type { Component, TuiMouseEvent } from "../src/tui.ts";
import { TuiAltScreen } from "../src/tui-alt-screen.ts";
import { TuiMainScreen } from "../src/tui-main-screen.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

class RecordingComponent implements Component {
	readonly widths: number[] = [];
	readonly mouseEvents: TuiMouseEvent[] = [];
	private readonly lines: string[];

	constructor(lines: string[]) {
		this.lines = lines;
	}

	render(width: number): string[] {
		this.widths.push(width);
		return this.lines;
	}

	handleMouse(event: TuiMouseEvent) {
		this.mouseEvents.push(event);
		return { handled: true };
	}

	invalidate(): void {}
}

describe("horizontal inset", () => {
	it("renders regular-mode content one column in from each edge", async () => {
		const terminal = new VirtualTerminal(20, 3);
		const tui = new TuiMainScreen(terminal);
		tui.setHorizontalInset(() => 1);
		const component = new RecordingComponent(["first", "", "third"]);
		tui.addChild(component);
		tui.start();
		await terminal.waitForRender();

		assert.strictEqual(component.widths.at(-1), 18);
		assert.deepStrictEqual(terminal.getViewport(), [" first", "", " third"]);
		tui.stop();
	});

	it("keeps right-anchored overlays inside the inset", async () => {
		const terminal = new VirtualTerminal(20, 3);
		const tui = new TuiMainScreen(terminal);
		tui.setHorizontalInset(() => 1);
		tui.addChild(new RecordingComponent([]));
		tui.showOverlay(new RecordingComponent(["OVER"]), { anchor: "top-right", width: 4 });
		tui.start();
		await terminal.waitForRender();

		assert.strictEqual(terminal.getViewport()[0], `${" ".repeat(15)}OVER `);
		tui.stop();
	});

	it("maps fullscreen mouse input through the inset", async () => {
		const terminal = new VirtualTerminal(20, 3);
		const tui = new TuiAltScreen(terminal);
		tui.setHorizontalInset(() => 1);
		const component = new RecordingComponent(["target"]);
		tui.setLayoutRoot(component);
		tui.start();
		await terminal.waitForRender();

		assert.strictEqual(component.widths.at(-1), 18);
		assert.strictEqual(terminal.getViewport()[0]?.trimEnd(), " target");

		terminal.sendInput("\x1b[<0;1;1M");
		terminal.sendInput("\x1b[<0;1;1m");
		assert.strictEqual(component.mouseEvents.length, 0);

		terminal.sendInput("\x1b[<0;2;1M");
		assert.deepStrictEqual(
			component.mouseEvents.map((event) => ({ x: event.x, screenX: event.screenX, width: event.width })),
			[{ x: 0, screenX: 1, width: 18 }],
		);
		tui.stop();
	});

	it("uses the full width until an inset is set", async () => {
		const terminal = new VirtualTerminal(20, 3);
		const tui = new TuiMainScreen(terminal);
		const component = new RecordingComponent(["first"]);
		tui.addChild(component);
		tui.start();
		await terminal.waitForRender();

		assert.strictEqual(component.widths.at(-1), 20);
		assert.strictEqual(terminal.getViewport()[0], "first");
		tui.stop();
	});
});
