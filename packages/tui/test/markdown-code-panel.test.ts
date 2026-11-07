import assert from "node:assert";
import { describe, it } from "node:test";
import { Chalk } from "chalk";
import { Markdown, type MarkdownTheme } from "../src/components/markdown.ts";
import { visibleWidth } from "../src/utils.ts";
import { defaultMarkdownTheme } from "./test-themes.ts";

const chalk = new Chalk({ level: 3 });
const SHADE = "\x1b[44m";
const panelTheme: MarkdownTheme = {
	...defaultMarkdownTheme,
	codeBlockBackground: (text) => `${SHADE}${text}\x1b[49m`,
};

function plain(line: string): string {
	return line.replace(/\x1b\[[0-9;]*m/g, "").trimEnd();
}

describe("Markdown code panels", () => {
	it("renders a top-level code block as a shaded full-width panel without fences", () => {
		const markdown = new Markdown("before\n\n```ts\nconst x = 1;\n```\n\nafter", 1, 0, panelTheme);
		const lines = markdown.render(24);

		assert.deepStrictEqual(lines.map(plain), [" before", "", "", "   const x = 1;", "", "", " after"]);
		for (const row of lines.slice(2, 5)) {
			assert.ok(row.startsWith(SHADE), `panel row is not shaded: ${JSON.stringify(row)}`);
			assert.strictEqual(visibleWidth(row), 24);
		}
		assert.ok(!lines[1]!.includes(SHADE) && !lines[5]!.includes(SHADE));
	});

	it("wraps long code between equal side gaps and indents every wrapped row", () => {
		const markdown = new Markdown("```\nabcdefghijklmnop\n```", 0, 0, panelTheme);
		const lines = markdown.render(12);

		assert.deepStrictEqual(lines.map(plain), ["", "  abcdefgh", "  ijklmnop", ""]);
		for (const row of lines) {
			assert.ok(row.startsWith(SHADE));
			assert.strictEqual(visibleWidth(row), 12);
		}
	});

	it("separates the panel from a directly following block", () => {
		const markdown = new Markdown("```\ncode\n```\nafter", 0, 0, panelTheme);

		assert.deepStrictEqual(markdown.render(20).map(plain), ["", "  code", "", "", "after"]);
	});

	it("keeps fences for code inside list items", () => {
		const markdown = new Markdown("- item\n\n  ```\n  code\n  ```", 0, 0, panelTheme);
		const lines = markdown.render(20).map(plain);

		assert.ok(lines.some((line) => line.includes("```")));
		assert.ok(markdown.render(20).every((line) => !line.includes(SHADE)));
	});

	it("highlights panel code once across streamed text and resizes", () => {
		const calls: string[] = [];
		const theme: MarkdownTheme = {
			...panelTheme,
			highlightCode: (code, lang) => {
				calls.push(`${lang}:${code}`);
				return code.split("\n").map((line) => chalk.green(line));
			},
		};
		const markdown = new Markdown("```ts\nx\n```", 0, 0, theme);
		markdown.render(80);
		markdown.setText("```ts\nx\n```\n\nafter");
		markdown.render(40);

		assert.deepStrictEqual(calls, ["ts:x"]);
		assert.ok(markdown.render(40)[1]!.includes(chalk.green("x")));
	});
});
