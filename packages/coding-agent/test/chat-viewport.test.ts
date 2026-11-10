import { Container, Text } from "@earendil-works/pi-tui";
import { describe, expect, test } from "vitest";
import { createChatViewport } from "../src/modes/interactive/chat-viewport.ts";

describe("chat viewport", () => {
	test("defaults the transcript scrollbar to auto and accepts overrides", () => {
		const automatic = createChatViewport({
			document: new Container(),
			pendingMessages: new Container(),
			status: new Container(),
			editor: new Container(),
			footer: new Container(),
			lastPrompt: new Container(),
		});
		const hidden = createChatViewport({
			document: new Container(),
			pendingMessages: new Container(),
			status: new Container(),
			editor: new Container(),
			footer: new Container(),
			lastPrompt: new Container(),
			scrollbar: "hidden",
		});

		expect(automatic.transcript.scrollbar).toBe("auto");
		expect(hidden.transcript.scrollbar).toBe("hidden");
	});

	test("scrolls widgets above the editor with the transcript and keeps status, footer and the last prompt fixed", () => {
		const label = (text: string) => new Text(text, 0, 0);
		const viewport = createChatViewport({
			document: label("transcript"),
			pendingMessages: label("pending"),
			status: label("status"),
			widgetsAbove: label("widgets above"),
			editor: label("editor"),
			widgetsBelow: label("widgets below"),
			footer: label("footer"),
			lastPrompt: label("last prompt"),
			scrollbar: "hidden",
		});
		const visible = (lines: string[]) => lines.map((line) => line.trim()).filter((line) => line.length > 0);

		expect(visible(viewport.transcript.render(20))).toEqual(["transcript", "widgets above"]);
		expect(visible(viewport.root.render(20))).not.toContain("widgets above");
		expect(visible(viewport.root.render(20))).toEqual(
			expect.arrayContaining(["pending", "status", "editor", "footer", "widgets below", "last prompt"]),
		);
	});
});
