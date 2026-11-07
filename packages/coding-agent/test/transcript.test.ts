import type { AssistantMessage } from "@earendil-works/pi-ai";
import { Text } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, test } from "vitest";
import { AssistantMessageComponent } from "../src/modes/interactive/components/assistant-message.ts";
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

const tool: TranscriptTool = { transcriptRole: "tool", render: () => ["tool row"], invalidate: () => {} };

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

		container.handleMouse({
			type: "click",
			button: "left",
			x: 5,
			y,
			screenX: 5,
			screenY: y,
			width: 100,
			height: lines.length,
			shift: false,
			alt: false,
			ctrl: false,
		});

		expect(plain(container.render(100))).toContain("   Thinking...");
	});
});
