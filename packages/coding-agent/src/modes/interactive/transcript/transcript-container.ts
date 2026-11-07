import { type Component, Container } from "@earendil-works/pi-tui";

export interface TranscriptLayout {
	readonly showHeader: boolean;
	readonly tight: boolean;
	readonly headerPadding: number;
	readonly bodyPadding: number;
}

export interface TranscriptMessage extends Component {
	readonly transcriptRole: "user" | "pi";
	setTranscriptLayout(layout: TranscriptLayout): void;
}

export interface TranscriptTool extends Component {
	readonly transcriptRole: "tool";
}

const NARROW_WIDTH = 80;
const SHORT_WINDOW_ROWS = 24;

export class TranscriptContainer extends Container {
	private readonly getPadding: () => number;
	private readonly getRows: () => number;

	constructor(getPadding: () => number, getRows: () => number) {
		super();
		this.getPadding = getPadding;
		this.getRows = getRows;
	}

	override render(width: number): string[] {
		const headerPadding = Math.min(Math.max(0, this.getPadding()), Math.max(0, width - 1));
		const bodyPadding = Math.min(
			width < NARROW_WIDTH ? 1 : headerPadding + 2,
			Math.max(0, Math.floor((width - 2) / 2)),
		);
		const tight = this.getRows() < SHORT_WINDOW_ROWS;

		let speaker: "user" | "pi" | undefined;
		for (const child of this.children) {
			const role =
				"transcriptRole" in child ? (child as TranscriptMessage | TranscriptTool).transcriptRole : undefined;
			if (role === "tool") continue;
			if (role === undefined) {
				speaker = undefined;
				continue;
			}

			const showHeader = role === "user" || speaker !== "pi";
			(child as TranscriptMessage).setTranscriptLayout({ showHeader, tight, headerPadding, bodyPadding });
			speaker = role;
		}

		return super.render(width);
	}
}
