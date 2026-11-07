import {
	replaceControlCharacters,
	stripTerminalSequences,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import type { ToolSummary } from "../../../core/extensions/types.ts";
import { formatArgumentPreview, formatToolDuration } from "../../../core/tools/render-utils.ts";
import { theme } from "../theme/theme.ts";

export type ToolRowStatus = "waiting" | "running" | "done" | "failed";

export interface ToolRowState {
	readonly status: ToolRowStatus;
	readonly durationMs?: number;
	readonly error?: string;
}

export interface ToolBranch {
	readonly row: string;
	readonly continuation: string;
	readonly output: string;
}

const INNER_BRANCH: ToolBranch = { row: "├─ ", continuation: "│  ", output: "│ " };
const LAST_BRANCH: ToolBranch = { row: "╰─ ", continuation: "   ", output: "  " };

const LABEL_WIDTH = 6;

export function genericToolSummary(toolName: string, args: unknown): ToolSummary {
	return { label: toolName, icon: "⌇", target: formatArgumentPreview(args) };
}

export function toolBranch(index: number, groupSize: number): ToolBranch | undefined {
	if (groupSize < 2) return undefined;
	return index === groupSize - 1 ? LAST_BRANCH : INNER_BRANCH;
}

export function renderToolRow(summary: ToolSummary, state: ToolRowState, width: number, branch?: ToolBranch): string[] {
	if (branch) {
		return renderToolRow(summary, state, width - branch.row.length).map(
			(line, index) => theme.fg("borderMuted", index === 0 ? branch.row : branch.continuation) + line,
		);
	}

	const parts = [statusGlyph(state.status)];
	if (summary.icon) parts.push(theme.fg("accent", plain(summary.icon)));
	parts.push(theme.bold(theme.fg("muted", plain(summary.label).padEnd(LABEL_WIDTH))));
	const target = plain(summary.target ?? "");
	if (target) parts.push(theme.fg("text", target));
	const title = parts.join(" ");

	const lines = [titleWithDuration(title, state.durationMs, width)];
	if (state.error) {
		lines.push(truncateToWidth(`  ${theme.fg("error", plain(state.error))}`, width, "…"));
	}
	return lines;
}

function statusGlyph(status: ToolRowStatus): string {
	switch (status) {
		case "waiting":
			return theme.fg("accent", "○");
		case "running":
			return theme.fg("accent", "◌");
		case "done":
			return theme.fg("muted", "✓");
		case "failed":
			return theme.fg("error", "×");
	}
}

function titleWithDuration(title: string, durationMs: number | undefined, width: number): string {
	if (durationMs === undefined) return truncateToWidth(title, width, "…");

	const duration = formatToolDuration(durationMs);
	const shown = truncateToWidth(title, width - visibleWidth(duration) - 1, "…");
	const gap = width - visibleWidth(shown) - visibleWidth(duration);
	return shown + " ".repeat(gap) + theme.fg("muted", duration);
}

function plain(text: string): string {
	return replaceControlCharacters(stripTerminalSequences(text)).replace(/\s+/g, " ").trim();
}
