import { describe, expect, it } from "vitest";
import type { ExtensionAPI } from "../../src/core/extensions/types.ts";
import { createReadToolDefinition } from "../../src/core/tools/read.ts";
import { withBuiltInRenderers } from "../../src/core/tools/renderers/index.ts";
import { createHarness } from "./harness.ts";

describe("tool summaries", () => {
	it("an extension overriding a built-in tool replaces its summary", async () => {
		const harness = await createHarness({
			extensionFactories: [
				(pi: ExtensionAPI) => {
					pi.registerTool({
						...createReadToolDefinition(process.cwd()),
						summarize: (args) => ({ label: "Peek", target: args.path }),
					});
				},
			],
		});

		try {
			const renderers = harness.session.extensionRunner.resolveToolRenderers("read", () =>
				withBuiltInRenderers("read", harness.session.getToolDefinition("read")),
			);
			const summary = renderers?.summarize?.({ path: "a.ts" });

			expect(summary).toEqual({ label: "Peek", target: "a.ts" });
		} finally {
			harness.cleanup();
		}
	});
});
