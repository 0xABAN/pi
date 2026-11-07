import { visibleWidth } from "@earendil-works/pi-tui";
import { beforeAll, describe, expect, test } from "vitest";
import { initTheme } from "../src/modes/interactive/theme/theme.ts";
import {
	genericToolSummary,
	renderToolRow,
	type ToolRowState,
	toolBranch,
} from "../src/modes/interactive/transcript/tool-row.ts";
import { stripAnsi } from "../src/utils/ansi.ts";

const read = { label: "Read", icon: "□", target: "src/app.ts" };
const done: ToolRowState = { status: "done", durationMs: 120, error: undefined };

function plain(lines: string[]): string[] {
	return lines.map(stripAnsi);
}

describe("renderToolRow", () => {
	beforeAll(() => initTheme("dark"));

	test("aligns the label and puts the duration at the right edge", () => {
		expect(plain(renderToolRow(read, done, 60))).toEqual([`✓ □ Read   src/app.ts${" ".repeat(35)}0.1s`]);
	});

	test("shows the call's status and no duration before it finishes", () => {
		const row = (status: ToolRowState["status"]) =>
			plain(renderToolRow(read, { status, durationMs: undefined, error: undefined }, 60))[0];

		expect(row("waiting")).toBe("○ □ Read   src/app.ts");
		expect(row("running")).toBe("◌ □ Read   src/app.ts");
	});

	test("adds the first error line below a failed call", () => {
		const failed: ToolRowState = { status: "failed", durationMs: 40, error: "old text not found" };

		expect(plain(renderToolRow({ label: "Edit", icon: "◈", target: "a.ts" }, failed, 60))).toEqual([
			`× ◈ Edit   a.ts${" ".repeat(41)}0.0s`,
			"  old text not found",
		]);
	});

	test("shortens the target before dropping the duration", () => {
		const long = { ...read, target: "src/a/very/deeply/nested/module/file.ts" };
		const [narrow] = plain(renderToolRow(long, done, 24));

		expect(visibleWidth(narrow)).toBe(24);
		expect(narrow).toBe("✓ □ Read src/a/ver… 0.1s");
		expect(plain(renderToolRow(long, done, 4))).toEqual(["✓ □…"]);
	});

	test("keeps tool text on one line without terminal sequences", () => {
		const summary = { label: "Run\n", icon: "↯", target: "echo a\n\x1b[31mb\x1b[0m\tc" };

		expect(plain(renderToolRow(summary, { ...done, durationMs: undefined }, 40))).toEqual(["✓ ↯ Run echo a b c"]);
	});

	test("draws an inner branch beside the row and its error line", () => {
		const failed: ToolRowState = { status: "failed", durationMs: undefined, error: "denied" };

		expect(plain(renderToolRow(read, failed, 30, toolBranch(0, 3, 30)))).toEqual([
			"├─ × □ Read src/app.ts",
			"│    denied",
		]);
	});

	test("ends the tree at the last call and leaves lone or cramped calls without one", () => {
		expect(plain(renderToolRow(read, done, 30, toolBranch(2, 3, 30)))).toEqual([
			`╰─ ✓ □ Read src/app.ts${" ".repeat(4)}0.1s`,
		]);
		expect(toolBranch(0, 1, 30)).toBeUndefined();
		expect(toolBranch(0, 3, 11)).toBeUndefined();
	});

	test("describes tools without a summary by name and arguments", () => {
		expect(genericToolSummary("deploy", { env: "prod" })).toEqual({
			label: "deploy",
			icon: "⌇",
			target: 'env="prod"',
		});
	});
});
