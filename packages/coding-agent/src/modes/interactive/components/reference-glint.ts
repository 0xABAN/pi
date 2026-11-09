import { foregroundAnsi, mixColors } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";

export const GLINT_FRAME_MS = 50;

const CHARS_PER_SECOND = 14;
const GLINT_WIDTH = 2.5;
const PAUSE_CHARS = 18;

export function referenceGlint(text: string, elapsedMs: number): string {
	const chars = [...text];
	const cycle = chars.length + PAUSE_CHARS;
	const glintAt = (((elapsedMs / 1000) * CHARS_PER_SECOND) % cycle) - GLINT_WIDTH;
	const { mdHeading, text: beige } = theme.colors;

	const painted = chars.map((char, index) => {
		const amount = Math.max(0, 1 - Math.abs(index - glintAt) / GLINT_WIDTH);
		return foregroundAnsi(mixColors(mdHeading, beige, amount, "srgb"), theme.getColorMode()) + char;
	});

	return `${painted.join("")}\x1b[39m`;
}
