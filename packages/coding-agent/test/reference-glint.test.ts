import { foregroundAnsi } from "@earendil-works/pi-tui";
import { describe, expect, it } from "vitest";
import { referenceGlint } from "../src/modes/interactive/components/reference-glint.ts";
import { initTheme, theme } from "../src/modes/interactive/theme/theme.ts";

describe("referenceGlint", () => {
	it("paints the reference with the heading color and sweeps the text color across it", () => {
		initTheme("dark");
		const heading = foregroundAnsi(theme.colors.mdHeading, theme.getColorMode());
		const glint = foregroundAnsi(theme.colors.text, theme.getColorMode());

		const resting = referenceGlint("/skill", 0);
		expect(resting).toContain(`${heading}l`);
		expect(resting).not.toContain(glint);

		const glinting = referenceGlint("/skill", (2.5 + 3) * (1000 / 14));
		expect(glinting).toContain(`${glint}i`);
		expect(glinting.endsWith("\x1b[39m")).toBe(true);
	});
});
