import type { AssistantMessage } from "@earendil-works/pi-ai";
import { Text, type TUI } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, test, vi } from "vitest";
import type { ToolRenderers } from "../src/core/extensions/types.ts";
import { withBuiltInRenderers } from "../src/core/tools/renderers/index.ts";
import { AssistantMessageComponent } from "../src/modes/interactive/components/assistant-message.ts";
import { ToolExecutionComponent } from "../src/modes/interactive/components/tool-execution.ts";
import { UserMessageComponent } from "../src/modes/interactive/components/user-message.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";
import { TranscriptContainer, type TranscriptTool } from "../src/modes/interactive/transcript/transcript-container.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

const SENT_AT = Date.UTC(2026, 10, 7, 14, 5);
const TIME = new Date(SENT_AT).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

function assistant(content: AssistantMessage["content"]): AssistantMessageComponent {
	return new AssistantMessageComponent({
		role: "assistant",
		content,
		api: "openai-responses",
		provider: "openai",
		model: "gpt-4o-mini",
		usage: {
			input: 0,
			output: 0,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 0,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop",
		timestamp: SENT_AT,
	});
}

function answer(text: string): AssistantMessageComponent {
	return assistant([{ type: "text", text }]);
}

function user(text: string): UserMessageComponent {
	return new UserMessageComponent(text, undefined, 1, [], undefined, undefined, SENT_AT);
}

const tool: TranscriptTool = {
	transcriptRole: "tool",
	setTranscriptLayout: () => {},
	render: () => ["tool row"],
	invalidate: () => {},
};

function transcript(children: TranscriptContainer["children"], rows = 40): TranscriptContainer {
	const container = new TranscriptContainer(
		() => 1,
		() => rows,
	);
	for (const child of children) container.addChild(child);
	return container;
}

function plain(lines: string[]): string[] {
	return lines.map((line) => stripAnsi(line).trimEnd());
}

const fakeTui = { requestRender: () => {} } as unknown as TUI;

function toolCall(name: string, args: unknown, renderers: ToolRenderers | undefined): ToolExecutionComponent {
	const component = new ToolExecutionComponent(name, `${name}-call`, args, {}, renderers, fakeTui, "/work");
	component.updateResult({ content: [{ type: "text", text: "contents" }], isError: false, durationMs: 1500 });
	return component;
}

function readCall(path: string): ToolExecutionComponent {
	return toolCall("read", { path }, withBuiltInRenderers("read", undefined));
}

function click(container: TranscriptContainer, y: number, height: number): void {
	container.handleMouse({
		type: "click",
		button: "left",
		x: 5,
		y,
		screenX: 5,
		screenY: y,
		width: 100,
		height,
		shift: false,
		alt: false,
		ctrl: false,
	});
}

describe("TranscriptContainer", () => {
	beforeAll(() => initTheme("dark"));

	test("shows one Pi header for answers and tool calls that follow each other", () => {
		const lines = transcript([user("question"), answer("first"), tool, answer("second")]).render(100);

		expect(plain(lines)).toEqual([
			` ◆ You · ${TIME}`,
			"   question",
			`   ${"─".repeat(94)}`,
			"",
			` ● Pi · ${TIME}`,
			"   first",
			"tool row",
			"",
			"   second",
		]);
	});

	test("repeats the Pi header after a notice", () => {
		const lines = transcript([answer("before"), new Text("notice", 1, 0), answer("after")]).render(100);

		expect(plain(lines).filter((line) => line.startsWith(" ● Pi"))).toHaveLength(2);
	});

	test("indents message text past the header from 80 columns, and aligns it below", () => {
		expect(plain(transcript([user("question")]).render(100)).slice(0, 2)).toEqual([
			` ◆ You · ${TIME}`,
			"   question",
		]);
		expect(plain(transcript([user("question")]).render(60)).slice(0, 2)).toEqual([` ◆ You · ${TIME}`, " question"]);
	});

	test("drops the blank row before the Pi header in short windows", () => {
		expect(plain(transcript([answer("short")], 20).render(100))).toEqual([` ● Pi · ${TIME}`, "   short"]);
	});

	test("draws user messages without their shaded background only inside the transcript", () => {
		const shade = theme.getBgAnsi("userMessageBg");

		expect(
			transcript([user("question")])
				.render(100)
				.join(""),
		).not.toContain(shade);
		expect(user("question").render(100).join("")).toContain(shade);
	});

	test("routes clicks below the header to the thinking block", () => {
		const container = transcript([
			assistant([
				{ type: "thinking", thinking: "deliberating" },
				{ type: "text", text: "done" },
			]),
		]);
		const lines = container.render(100);
		const y = plain(lines).indexOf("   deliberating");

		click(container, y, lines.length);

		expect(plain(container.render(100))).toContain("   Thinking...");
	});
});

describe("transcript tool rows", () => {
	beforeAll(() => initTheme("dark"));

	const row = (path: string) => `   ✓ □ Read   ${path}${" ".repeat(74)}1.5s`;

	test("draws each tool call as one row, with a blank line only before the first", () => {
		const lines = transcript([answer("checking"), readCall("src/a.ts"), readCall("src/b.ts")]).render(100);

		expect(plain(lines)).toEqual(["", ` ● Pi · ${TIME}`, "   checking", "", row("src/a.ts"), row("src/b.ts")]);
	});

	test("keeps rows together across Pi messages that only call tools", () => {
		const callOnly = assistant([{ type: "toolCall", id: "b", name: "read", arguments: { path: "src/b.ts" } }]);
		const lines = transcript([answer("checking"), readCall("src/a.ts"), callOnly, readCall("src/b.ts")]).render(100);

		expect(plain(lines)).toEqual(["", ` ● Pi · ${TIME}`, "   checking", "", row("src/a.ts"), row("src/b.ts")]);
	});

	test("expands a call's full output on a click and collapses it on the next", () => {
		const container = transcript([readCall("src/a.ts")]);
		const collapsed = plain(container.render(100));
		const y = collapsed.indexOf(row("src/a.ts"));

		click(container, y, collapsed.length);
		const expanded = plain(container.render(100));
		expect(expanded.slice(0, 2)).toEqual(collapsed);
		expect(expanded.some((line) => /read src\/a\.ts/.test(line))).toBe(true);
		expect(expanded.some((line) => line.includes("contents"))).toBe(true);

		click(container, y, expanded.length);
		expect(plain(container.render(100))).toEqual(collapsed);
	});

	test("hides a collapsed call's output and names tools without a summary", () => {
		const lines = plain(transcript([toolCall("deploy", { env: "prod" }, undefined)]).render(100));

		expect(lines).toEqual(["", `   ✓ ⌇ deploy env="prod"${" ".repeat(72)}1.5s`]);
	});

	test("summarizes a call again only when it changes", () => {
		const summarize = vi.fn(() => ({ label: "Peek" }));
		const call = toolCall("peek", {}, { summarize });
		const container = transcript([call]);

		container.render(100);
		container.render(100);
		expect(summarize).toHaveBeenCalledTimes(1);

		call.updateResult({ content: [], isError: true });
		expect(plain(container.render(100))[1]).toBe("   × Peek");
		expect(summarize).toHaveBeenCalledTimes(2);
	});
});
