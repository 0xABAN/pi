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
	readonly durationMs: number | undefined;
	readonly error: string | undefined;
}

const LABEL_WIDTH = 6;
const ALIGNED_LABEL_MIN_WIDTH = 60;

export function genericToolSummary(toolName: string, args: unknown): ToolSummary {
	return { label: toolName, icon: "⌇", target: formatArgumentPreview(args) };
}

export function renderToolRow(summary: ToolSummary, state: ToolRowState, width: number): string[] {
	const label = plain(summary.label);
	const shownLabel = width < ALIGNED_LABEL_MIN_WIDTH ? label : label.padEnd(LABEL_WIDTH);
	const parts = [statusGlyph(state.status)];
	if (summary.icon) parts.push(theme.fg("accent", plain(summary.icon)));
	parts.push(theme.bold(theme.fg("muted", shownLabel)));
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
	const room = width - visibleWidth(duration) - 1;
	if (room < 1) return truncateToWidth(title, width, "…");

	const shown = truncateToWidth(title, room, "…");
	const gap = width - visibleWidth(shown) - visibleWidth(duration);
	return shown + " ".repeat(gap) + theme.fg("muted", duration);
}

function plain(text: string): string {
	return replaceControlCharacters(stripTerminalSequences(text)).replace(/\s+/g, " ").trim();
}
