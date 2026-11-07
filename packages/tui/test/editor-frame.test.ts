import assert from "node:assert";
import { describe, it } from "node:test";
import { Editor } from "../src/components/editor.ts";
import { TuiMainScreen } from "../src/tui-main-screen.ts";
import { defaultEditorTheme } from "./test-themes.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

class TallEditor extends Editor {
	protected override maxVisibleLines(): number {
		return 8;
	}
}

describe("Editor frame hooks", () => {
	it("lets subclasses set the visible line limit and read the rendered count", () => {
		const editor = new TallEditor(new TuiMainScreen(new VirtualTerminal(40, 24)), defaultEditorTheme);
		editor.setText(Array.from({ length: 12 }, (_, i) => `line ${i}`).join("\n"));

		const lines = editor.render(40);

		assert.strictEqual(editor.renderedVisibleLineCount, 8);
		assert.strictEqual(lines.length, 10);
		assert.match(lines[0], /↑ 4 more/);
	});
});
