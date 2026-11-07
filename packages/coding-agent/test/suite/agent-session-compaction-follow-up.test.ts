import { fauxAssistantMessage } from "@earendil-works/pi-ai";
import { afterEach, describe, expect, it } from "vitest";
import { createHarness, getAssistantTexts, type Harness } from "./harness.ts";

describe("AgentSession follow-ups sent as end-of-run compaction finishes", () => {
	const harnesses: Harness[] = [];

	afterEach(() => {
		while (harnesses.length > 0) harnesses.pop()?.cleanup();
	});

	it.each([0, 1, 2, 3, 4])("answers the follow-up with %i input handlers", async (inputHandlers) => {
		const harness = await createHarness({
			models: [{ id: "faux-1", contextWindow: 2600, maxTokens: 100 }],
			settings: { compaction: { enabled: true, reserveTokens: 400, keepRecentTokens: 1 } },
			extensionFactories: [
				(pi) => {
					pi.on("session_before_compact", async (event) => ({
						compaction: {
							summary: "compacted history",
							firstKeptEntryId: event.preparation.firstKeptEntryId,
							tokensBefore: event.preparation.tokensBefore,
							details: {},
						},
					}));
					for (let i = 0; i < inputHandlers; i++) {
						pi.on("input", () => ({ action: "continue" as const }));
					}
				},
			],
		});
		harnesses.push(harness);
		harness.setResponses([
			fauxAssistantMessage(`history:${"a".repeat(400)}`),
			fauxAssistantMessage(`final:${"b".repeat(4800)}`),
			fauxAssistantMessage("answered the follow-up"),
		]);
		await harness.session.prompt("seed history");

		let followUp: Promise<void> | undefined;
		harness.session.subscribe((event) => {
			if (event.type === "compaction_end" && !followUp) {
				followUp = harness.session.prompt("typed during compaction", { streamingBehavior: "followUp" });
			}
		});
		await harness.session.prompt("finish with a long answer");
		await followUp;
		await harness.session.waitForIdle();

		expect(harness.eventsOfType("compaction_end")).toHaveLength(1);
		expect(getAssistantTexts(harness).at(-1)).toBe("answered the follow-up");
		expect(harness.session.agent.hasQueuedMessages()).toBe(false);
	});
});
