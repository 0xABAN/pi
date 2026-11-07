import { type Component, Container, type TuiMouseEvent, truncateToWidth } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";

const NARROW_WIDTH = 80;
const MIN_CONTENT_WIDTH = 3;

export class ExtensionDialog extends Container {
	private frame = { width: -1, padding: 0, inner: 0, contentWidth: 0 };

	override render(width: number): string[] {
		const padding = Math.min(width < NARROW_WIDTH ? 1 : 3, Math.max(0, Math.floor((width - 2) / 2)));
		const inner = Math.max(1, width - padding * 2);
		const contentWidth = Math.max(MIN_CONTENT_WIDTH, inner);
		this.frame = { width, padding, inner, contentWidth };

		const gutter = " ".repeat(padding);
		return super
			.render(contentWidth)
			.map((line) => gutter + (contentWidth > inner ? truncateToWidth(line, inner, "") : line));
	}

	override handleMouse(event: TuiMouseEvent): ReturnType<Container["handleMouse"]> {
		if (this.frame.width !== event.width) this.render(event.width);

		const { padding, inner, contentWidth } = this.frame;
		const x = event.x - padding;
		if (x < 0 || x >= inner) return undefined;
		return super.handleMouse({ ...event, x, width: contentWidth });
	}
}

export class DialogBorder implements Component {
	private readonly bottom: boolean;

	constructor(position: "top" | "bottom") {
		this.bottom = position === "bottom";
	}

	render(width: number): string[] {
		if (width < 2) return [theme.fg("borderMuted", "─".repeat(width))];

		const [left, right] = this.bottom ? ["╰", "╯"] : ["╭", "╮"];
		return [theme.fg("borderMuted", left + "─".repeat(width - 2) + right)];
	}

	invalidate(): void {}
}

export function dialogHeading(title: string): string {
	const [first = "", ...rest] = title.split("\n");
	const heading = theme.fg("accent", "◈ ") + theme.fg("muted", theme.bold(first));
	return rest.length > 0 ? `${heading}\n${theme.fg("text", rest.join("\n"))}` : heading;
}
