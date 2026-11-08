import { visibleWidth } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";

export interface EditorBadgeParts {
	response: string | undefined;
	statuses: string[];
	branch: string | null;
	changes: number;
}

function trail(...parts: string[]): string {
	return parts.filter(Boolean).join(" ❯ ");
}

export function renderEditorBadges(parts: EditorBadgeParts, budget: number): string {
	const response = parts.response ? theme.inverse(theme.fg("accent", ` ${parts.response} `)) : "";
	const branch = parts.branch ? theme.fg("mdHeading", `⎇ ${parts.branch}`) : "";
	const changes = branch && parts.changes > 0 ? theme.fg("muted", `*${parts.changes}`) : "";
	const branchWithChanges = [branch, changes].filter(Boolean).join(" ");

	const candidates = [
		[response, trail(...parts.statuses, branchWithChanges)],
		[response, trail(...parts.statuses, branch)],
		[trail(...parts.statuses, branchWithChanges)],
		[trail(...parts.statuses)],
	];

	return (
		candidates.map((badges) => badges.filter(Boolean).join("   ")).find((badges) => visibleWidth(badges) <= budget) ??
		""
	);
}
