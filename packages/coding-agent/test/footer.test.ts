import { stripTerminalSequences, visibleWidth } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, it } from "vitest";
import type { AgentSession } from "../src/core/agent-session.ts";
import type { ReadonlyFooterDataProvider } from "../src/core/footer-data-provider.ts";
import { FooterComponent, LastPromptComponent } from "../src/modes/interactive/components/footer.ts";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";

type Entry = Record<string, unknown>;

function createSession(options: { modelName?: string; percent?: number | null; entries?: Entry[] } = {}) {
	const entries = options.entries ?? [];
	let leafId = 0;
	const session = {
		state: {
			model: { id: "claude-opus-5-5", name: options.modelName ?? "Claude Opus 5.5 1M", contextWindow: 1_000_000 },
		},
		model: undefined,
		sessionManager: {
			getEntries: () => entries,
			getBranch: () => entries,
			getEntryCount: () => entries.length,
			getSessionId: () => "test-session",
			getLeafId: () => `leaf-${leafId}`,
		},
		getContextUsage: () => ({
			contextWindow: 1_000_000,
			percent: options.percent === undefined ? 1 : options.percent,
		}),
	};
	const append = (entry: Entry) => {
		entries.push(entry);
		leafId++;
	};
	return { session: session as unknown as AgentSession, append };
}

function createFooterData(footerStatuses: Record<string, string> = {}): ReadonlyFooterDataProvider {
	return {
		getGitBranch: () => "main",
		getGitChanges: () => 0,
		getExtensionStatuses: (placement = "editor") =>
			new Map(placement === "footer" ? Object.entries(footerStatuses) : []),
		onBranchChange: () => () => {},
	};
}

function userMessage(content: unknown): Entry {
	return { type: "message", message: { role: "user", content } };
}

const plain = (lines: string[]) => lines.map(stripTerminalSequences);

beforeAll(() => initTheme("dark"));

describe("footer bar", () => {
	it("shows the model and footer statuses on the left and context on the right", () => {
		const { session } = createSession();
		const footer = new FooterComponent(session, createFooterData({ "agent-thinking": "think:med" }));

		const [line] = plain(footer.render(100));

		expect(line).toMatch(/^ Opus 5\.5 1M ❯ think:med +● \[▱▱▱▱▱\] 1% context $/);
		expect(visibleWidth(line!)).toBe(100);
	});

	it("adds the session cost once it is above zero", () => {
		const usage = { input: 100, output: 10, cacheRead: 0, cacheWrite: 0, cost: { total: 1.234 } };
		const { session } = createSession({ entries: [{ type: "message", message: { role: "assistant", usage } }] });

		expect(plain(new FooterComponent(session, createFooterData()).render(100))[0]).toContain("$1.23 ● [");
	});

	it("shortens the context meter in narrow terminals and marks unknown usage", () => {
		const { session } = createSession({ percent: 64 });
		const footer = new FooterComponent(session, createFooterData());

		expect(plain(footer.render(70))[0]).toMatch(/● \[▰▰▰▱▱\] 64% $/);
		expect(plain(footer.render(50))[0]).toMatch(/● 64% $/);
		expect(
			plain(new FooterComponent(createSession({ percent: null }).session, createFooterData()).render(100))[0],
		).toMatch(/● \[-----\] \? context $/);
	});

	it("truncates the left side before the context", () => {
		const { session } = createSession({ modelName: "模".repeat(40) });
		const [line] = plain(new FooterComponent(session, createFooterData()).render(40));

		expect(line).toMatch(/… ● 1% $/);
		expect(visibleWidth(line!)).toBe(40);
	});
});

describe("last prompt line", () => {
	it("shows the latest user prompt on the branch without skill blocks", () => {
		const { session, append } = createSession();
		const line = new LastPromptComponent(session);
		expect(line.render(80)).toEqual([]);

		append(userMessage("first   question\nwith lines"));
		expect(plain(line.render(80))).toEqual([" ↳ first question with lines"]);

		append({ type: "message", message: { role: "assistant", content: [] } });
		append(
			userMessage([{ type: "text", text: '<skill name="write" location="/x">\nbody\n</skill>\n\ntighten this' }]),
		);
		expect(plain(line.render(80))).toEqual([" ↳ tighten this"]);
	});

	it("truncates long prompts and hides in very narrow terminals", () => {
		const { session, append } = createSession();
		append(userMessage("a fairly long prompt that will not fit"));
		const line = new LastPromptComponent(session);

		expect(plain(line.render(20))).toEqual([" ↳ a fairly long pr…"]);
		expect(line.render(12)).toEqual([]);
	});
});
