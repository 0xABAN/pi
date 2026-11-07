import assert from "node:assert";
import { describe, it } from "node:test";
import { CombinedAutocompleteProvider } from "../src/autocomplete.ts";
import { Editor } from "../src/components/editor.ts";
import { renderFakeCursor } from "../src/tui.ts";
import { TuiMainScreen } from "../src/tui-main-screen.ts";
import { defaultEditorTheme } from "./test-themes.ts";
import { VirtualTerminal } from "./virtual-terminal.ts";

const commands = [
	{ name: "model", description: "Select the active model" },
	{ name: "simplify", description: "Clean up a diff", inline: true },
	{ name: "writing-pull-requests", description: "Draft a PR", inline: true },
];

function suggest(lines: string[], line = lines.length - 1) {
	const provider = new CombinedAutocompleteProvider(commands, process.cwd());
	const col = lines[line]!.length;
	return provider.getSuggestions(lines, line, col, { signal: new AbortController().signal });
}

async function flush(): Promise<void> {
	await new Promise((resolve) => setTimeout(resolve, 0));
	await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("inline command completion", () => {
	it("offers only inline commands for a slash after whitespace", async () => {
		const result = await suggest(["review this /sim"]);
		assert.deepStrictEqual(
			result?.items.map((item) => item.value),
			["simplify"],
		);
		assert.strictEqual(result?.prefix, "sim");
	});

	it("matches on later lines and in words after a leading command", async () => {
		for (const lines of [["first line", "/writ"], ["/model and /writ"]]) {
			const result = await suggest(lines);
			assert.deepStrictEqual(
				result?.items.map((item) => item.value),
				["writing-pull-requests"],
			);
		}
	});

	it("keeps the leading command menu and never suggests paths for a word starting with a slash", async () => {
		const leading = await suggest(["/mod"]);
		assert.ok(leading?.items.some((item) => item.value === "model"));
		assert.strictEqual(await suggest(["look in /usr"]), null);
	});

	it("inserts the command with a trailing space without submitting", async () => {
		const editor = new Editor(new TuiMainScreen(new VirtualTerminal(80, 24)), defaultEditorTheme);
		const provider = new CombinedAutocompleteProvider(commands, process.cwd());
		let submitted: string | undefined;
		editor.onSubmit = (text) => {
			submitted = text;
		};
		editor.setAutocompleteProvider(provider);

		for (const char of "fix it /sim") editor.handleInput(char);
		await flush();
		assert.strictEqual(editor.isShowingAutocomplete(), true);

		editor.handleInput("\r");
		assert.strictEqual(editor.getText(), "fix it /simplify ");
		assert.strictEqual(submitted, undefined);
	});
});

describe("editor highlights", () => {
	it("styles highlighted ranges and keeps the cursor inside them", () => {
		const editor = new Editor(new TuiMainScreen(new VirtualTerminal(40, 24)), defaultEditorTheme);
		editor.setHighlighter((line) => {
			const start = line.indexOf("/simplify");
			return start < 0 ? [] : [{ start, end: start + "/simplify".length, style: (text) => `<${text}>` }];
		});
		editor.setText("use /simplify now");

		assert.ok(editor.render(40)[1]!.includes("use </simplify> now"));

		editor.handleInput("\x1b[H");
		for (let i = 0; i < 6; i++) editor.handleInput("\x1b[C");
		assert.ok(editor.render(40)[1]!.includes(`use </s>${renderFakeCursor("<i>")}<mplify> now`));
	});
});
