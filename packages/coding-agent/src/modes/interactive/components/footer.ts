import { type Component, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { type AgentSession, parseSkillBlocks } from "../../../core/agent-session.ts";
import type { ContextUsage } from "../../../core/extensions/types.ts";
import type { ReadonlyFooterDataProvider } from "../../../core/footer-data-provider.ts";
import type { SessionEntry } from "../../../core/session-manager.ts";
import { addUsageToTotals, createUsageTotals } from "../../../core/usage-totals.ts";
import { theme } from "../theme/theme.ts";

export function formatTokens(count: number): string {
	if (count < 1000) return count.toString();
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	if (count < 1000000) return `${Math.round(count / 1000)}k`;
	if (count < 10000000) return `${(count / 1000000).toFixed(1)}M`;
	return `${Math.round(count / 1000000)}M`;
}

function sanitizeStatusText(text: string): string {
	return text.replace(/[\r\n\t]+/g, " ").trim();
}

export function sortedStatuses(statuses: ReadonlyMap<string, string>): string[] {
	return [...statuses]
		.sort(([a], [b]) => a.localeCompare(b))
		.map(([, text]) => sanitizeStatusText(text))
		.filter(Boolean);
}

function formatContext(usage: ContextUsage | undefined, width: number): string {
	const percent = usage?.percent ?? null;
	const meter = percent === null ? "-----" : "▰".repeat(Math.round(Math.min(100, percent) / 20)).padEnd(5, "▱");
	const amount = percent === null ? "?" : `${Math.round(percent)}%`;
	const text = width < 60 ? `● ${amount}` : width < 80 ? `● [${meter}] ${amount}` : `● [${meter}] ${amount} context`;
	const color = percent !== null && percent > 90 ? "error" : percent !== null && percent > 70 ? "warning" : "accent";
	return theme.fg(color, text);
}

interface SessionStats {
	session: AgentSession;
	sessionId: string;
	leafId: string | null;
	entryCount: number;
	limitsModel: unknown;
	cost: number;
	contextUsage: ContextUsage | undefined;
}

export class FooterComponent implements Component {
	private session: AgentSession;
	private footerData: ReadonlyFooterDataProvider;
	private sessionStats?: SessionStats;

	constructor(session: AgentSession, footerData: ReadonlyFooterDataProvider) {
		this.session = session;
		this.footerData = footerData;
	}

	setSession(session: AgentSession): void {
		this.session = session;
	}

	invalidate(): void {}

	dispose(): void {}

	private getSessionStats(): SessionStats {
		const sessionManager = this.session.sessionManager;
		const entryCount = sessionManager.getEntryCount();
		const sessionId = sessionManager.getSessionId();
		const leafId = sessionManager.getLeafId();
		const limitsModel = this.session.routedModel?.model ?? this.session.model;
		const cached = this.sessionStats;
		if (
			cached &&
			cached.session === this.session &&
			cached.sessionId === sessionId &&
			cached.leafId === leafId &&
			cached.entryCount === entryCount &&
			cached.limitsModel === limitsModel
		) {
			return cached;
		}

		const usageTotals = createUsageTotals();
		for (const entry of sessionManager.getEntries()) {
			if (entry.type === "usage") {
				addUsageToTotals(usageTotals, entry.usage);
			} else if (entry.type === "message" && entry.message.role === "assistant") {
				addUsageToTotals(usageTotals, entry.message.usage);
			} else if (entry.type === "message" && entry.message.role === "toolResult" && entry.message.usage) {
				addUsageToTotals(usageTotals, entry.message.usage);
			} else if ((entry.type === "branch_summary" || entry.type === "compaction") && entry.usage) {
				addUsageToTotals(usageTotals, entry.usage);
			}
		}

		this.sessionStats = {
			session: this.session,
			sessionId,
			leafId,
			entryCount,
			limitsModel,
			cost: usageTotals.cost,
			contextUsage: this.session.getContextUsage(),
		};
		return this.sessionStats;
	}

	render(width: number): string[] {
		const { cost, contextUsage } = this.getSessionStats();
		const model = this.session.state.model;
		const modelName = model ? (model.name || model.id).replace(/^Claude /, "") : "no model";
		const left = [
			theme.fg("text", modelName),
			...sortedStatuses(this.footerData.getExtensionStatuses("footer")),
		].join(theme.fg("dim", " ❯ "));
		const right = [cost > 0 ? theme.fg("muted", `$${cost.toFixed(2)}`) : "", formatContext(contextUsage, width)]
			.filter(Boolean)
			.join(" ");

		const leftRoom = width - visibleWidth(right) - 3;
		const shownLeft = leftRoom > 0 ? truncateToWidth(left, leftRoom, "…") : "";
		const gap = Math.max(1, width - 2 - visibleWidth(shownLeft) - visibleWidth(right));
		return [truncateToWidth(` ${shownLeft}${" ".repeat(gap)}${right} `, width, "")];
	}
}

function findLastPrompt(branch: readonly SessionEntry[]): string {
	for (let index = branch.length - 1; index >= 0; index--) {
		const entry = branch[index]!;
		if (entry.type !== "message" || entry.message.role !== "user") continue;

		const content = entry.message.content;
		const text =
			typeof content === "string"
				? content
				: content
						.filter((block) => block.type === "text")
						.map((block) => block.text)
						.join("\n");
		const skills = parseSkillBlocks(text);
		return (skills ? (skills.userMessage ?? "") : text).replace(/\s+/g, " ").trim();
	}
	return "";
}

export class LastPromptComponent implements Component {
	private session: AgentSession;
	private cache: { session: AgentSession; sessionId: string; leafId: string | null; prompt: string } | undefined;

	constructor(session: AgentSession) {
		this.session = session;
	}

	setSession(session: AgentSession): void {
		this.session = session;
	}

	invalidate(): void {}

	private lastPrompt(): string {
		const sessionManager = this.session.sessionManager;
		const sessionId = sessionManager.getSessionId();
		const leafId = sessionManager.getLeafId();
		const cached = this.cache;
		if (cached && cached.session === this.session && cached.sessionId === sessionId && cached.leafId === leafId) {
			return cached.prompt;
		}

		const prompt = findLastPrompt(sessionManager.getBranch());
		this.cache = { session: this.session, sessionId, leafId, prompt };
		return prompt;
	}

	render(width: number): string[] {
		const prompt = this.lastPrompt();
		const room = width - 3;
		if (!prompt || room < 10) return [];
		return [` ${theme.fg("dim", "↳")} ${theme.fg("dim", truncateToWidth(prompt, room, "…"))}`];
	}
}
