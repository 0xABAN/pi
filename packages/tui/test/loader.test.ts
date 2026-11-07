import assert from "node:assert";
import { describe, it } from "node:test";
import { Loader } from "../src/components/loader.ts";
import type { TUI } from "../src/tui.ts";

const ui = { requestRender() {} } as unknown as TUI;

function shownLine(loader: Loader): string {
	return loader.render(40)[1]!.trim();
}

describe("Loader", () => {
	it("draws frames built from the message as the whole line", (t) => {
		t.mock.timers.enable({ apis: ["setInterval"] });
		const loader = new Loader(
			ui,
			(text) => `<${text}>`,
			(text) => `[${text}]`,
			"Working",
			{
				frames: (message) => [`* ${message} *`, `+ ${message} +`],
				intervalMs: 100,
			},
		);

		assert.strictEqual(shownLine(loader), "* Working *");

		t.mock.timers.tick(100);
		assert.strictEqual(shownLine(loader), "+ Working +");

		loader.setMessage("Compacting");
		assert.strictEqual(shownLine(loader), "+ Compacting +");

		t.mock.timers.tick(100);
		assert.strictEqual(shownLine(loader), "* Compacting *");

		loader.stop();
	});

	it("keeps the message after plain frames", () => {
		const loader = new Loader(
			ui,
			(text) => text,
			(text) => text,
			"Working",
			{ frames: ["*"] },
		);

		assert.strictEqual(shownLine(loader), "* Working");

		loader.stop();
	});
});
