import { homedir } from "node:os";
import { join } from "node:path";
import { Text } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import type { ToolRenderers } from "../src/core/extensions/types.ts";
import { formatArgumentPreview } from "../src/core/tools/render-utils.ts";
import { createAllToolRenderers, readRenderers, withBuiltInRenderers } from "../src/core/tools/renderers/index.ts";
import { codemodeRenderers } from "../src/extensions/codemode/renderer.ts";
import { createMcpToolRenderers } from "../src/extensions/mcp/tools.ts";
import { createToolSearchToolDefinition } from "../src/extensions/tool-search/tool.ts";

const renderers = createAllToolRenderers();

function summarize(tool: Pick<ToolRenderers, "summarize">, args: unknown) {
	return tool.summarize!(args);
}

describe("built-in tool summaries", () => {
	it("read shows the path and line range", () => {
		const args = { path: join(homedir(), "src", "app.ts"), offset: 10, limit: 31 };

		expect(summarize(renderers.read, args)).toEqual({
			label: "Read",
			icon: "□",
			target: `${join("~", "src", "app.ts")}:10-40`,
		});
		expect(summarize(renderers.read, {}).target).toBe("");
	});

	it("edit and write show the path", () => {
		expect(summarize(renderers.edit, { path: "src/app.ts", edits: [] })).toEqual({
			label: "Edit",
			icon: "◈",
			target: "src/app.ts",
		});
		expect(summarize(renderers.write, { path: "notes.md", content: "a" })).toEqual({
			label: "Write",
			icon: "◇",
			target: "notes.md",
		});
	});

	it("shell tools show the command under their own label", () => {
		expect(summarize(renderers.bash, { command: "npm test" })).toEqual({
			label: "Bash",
			icon: "↯",
			target: "npm test",
		});
		expect(summarize(renderers.powershell, { command: "Get-ChildItem" })).toEqual({
			label: "PowerShell",
			icon: "↯",
			target: "Get-ChildItem",
		});
		expect(summarize(renderers.bash, {}).target).toBe("");
	});

	it("search tools show the pattern and path", () => {
		expect(summarize(renderers.grep, { pattern: "TODO", path: "src" })).toEqual({
			label: "Grep",
			icon: "◎",
			target: "TODO · src",
		});
		expect(summarize(renderers.find, { pattern: "*.ts" })).toEqual({ label: "Find", icon: "⊙", target: "*.ts" });
		expect(summarize(renderers.grep, {}).target).toBe("");
	});

	it("ls shows the directory", () => {
		expect(summarize(renderers.ls, { path: "src" })).toEqual({ label: "Ls", icon: "▧", target: "src" });
		expect(summarize(renderers.ls, {}).target).toBe(".");
	});
});

describe("extension tool summaries", () => {
	it("codemode shows the script", () => {
		expect(summarize(codemodeRenderers, { code: "return 1" })).toEqual({
			label: "Codemode",
			icon: "⋈",
			target: "return 1",
		});
	});

	it("tool search shows the query", () => {
		expect(summarize(createToolSearchToolDefinition(), { query: "github issues" })).toEqual({
			label: "Tool Search",
			icon: "⊙",
			target: "github issues",
		});
	});

	it("MCP tools show the server, tool and arguments", () => {
		const mcp = createMcpToolRenderers("docs/search");

		expect(summarize(mcp, { query: "pi", limit: 5 })).toEqual({
			label: "MCP",
			icon: "⌇",
			target: 'docs/search query="pi" limit=5',
		});
		expect(summarize(mcp, {}).target).toBe("docs/search");
	});
});

describe("formatArgumentPreview", () => {
	it("formats arguments as key=value pairs on one line", () => {
		expect(formatArgumentPreview({ query: "pi", limit: 5, filters: { lang: "ts" } })).toBe(
			'query="pi" limit=5 filters={"lang":"ts"}',
		);
		expect(formatArgumentPreview({})).toBe("");
		expect(formatArgumentPreview(undefined)).toBe("");
		expect(formatArgumentPreview([1, 2])).toBe("args=[1,2]");
	});

	it("cuts long arguments", () => {
		const preview = formatArgumentPreview({ content: "x".repeat(500) });

		expect(preview).toHaveLength(100);
		expect(preview.endsWith("...")).toBe(true);
	});
});

describe("built-in renderer merge", () => {
	it("fills in the built-in summary when a definition has none", () => {
		const renderCall = () => new Text("custom", 0, 0);
		const definition: ToolRenderers = { renderCall };
		const merged = withBuiltInRenderers("read", definition);

		expect(merged?.renderCall).toBe(renderCall);
		expect(merged?.summarize).toBe(readRenderers.summarize);
	});

	it("keeps a definition's own summary", () => {
		const summarizeRead = () => ({ label: "Peek" });

		expect(withBuiltInRenderers("read", { summarize: summarizeRead })?.summarize).toBe(summarizeRead);
	});

	it("leaves tools that are not built in alone", () => {
		const definition = { summarize: () => ({ label: "Mine" }) };

		expect(withBuiltInRenderers("custom_tool", definition)).toBe(definition);
		expect(withBuiltInRenderers("custom_tool", undefined)).toBeUndefined();
	});
});
