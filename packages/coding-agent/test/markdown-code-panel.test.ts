import { Markdown } from "@earendil-works/pi-tui";
import { describe, expect, test } from "vitest";
import { getMarkdownTheme, initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

describe("Markdown code blocks", () => {
	test("render as panels in the theme's user message background", () => {
		initTheme("dark");
		const lines = new Markdown("```ts\nconst x = 1;\n```", 0, 0, getMarkdownTheme()).render(30);

		expect(lines.map(stripAnsi).join("\n")).not.toContain("```");
		expect(lines).toHaveLength(3);
		for (const line of lines) expect(line.startsWith(theme.getBgAnsi("userMessageBg"))).toBe(true);
	});
});
