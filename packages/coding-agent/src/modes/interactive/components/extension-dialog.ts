import { type Component, Container, type TuiMouseEvent } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";
import { NARROW_WIDTH } from "../transcript/transcript-container.ts";

export class ExtensionDialog extends Container {
	override render(width: number): string[] {
		const gutter = " ".repeat(dialogPadding(width));
		return super.render(width - 2 * gutter.length).map((line) => gutter + line);
	}

	override handleMouse(event: TuiMouseEvent): ReturnType<Container["handleMouse"]> {
		const padding = dialogPadding(event.width);
		const contentWidth = event.width - 2 * padding;
		const x = event.x - padding;
		if (x < 0 || x >= contentWidth) return undefined;
		return super.handleMouse({ ...event, x, width: contentWidth });
	}
}

export class DialogBorder implements Component {
	private readonly corners: readonly [string, string];

	constructor(position: "top" | "bottom") {
		this.corners = position === "top" ? ["╭", "╮"] : ["╰", "╯"];
	}

	render(width: number): string[] {
		const [left, right] = this.corners;
		return [theme.fg("borderMuted", left + "─".repeat(width - 2) + right)];
	}

	invalidate(): void {}
}

export function dialogHeading(title: string): string {
	const [first = "", ...rest] = title.split("\n");
	const heading = theme.fg("accent", "◈ ") + theme.fg("muted", theme.bold(first));
	return rest.length > 0 ? `${heading}\n${theme.fg("text", rest.join("\n"))}` : heading;
}

function dialogPadding(width: number): number {
	return width < NARROW_WIDTH ? 1 : 3;
}
