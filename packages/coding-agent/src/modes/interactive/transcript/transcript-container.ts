import { type Component, Container } from "@earendil-works/pi-tui";

export interface TranscriptLayout {
	readonly showHeader: boolean;
	readonly tight: boolean;
	readonly headerPadding: number;
	readonly bodyPadding: number;
}

export interface TranscriptMessage extends Component {
	readonly transcriptRole: "user" | "pi";
	readonly isEmpty: boolean;
	setTranscriptLayout(layout: TranscriptLayout): void;
}

export interface TranscriptToolLayout {
	readonly index: number;
	readonly groupSize: number;
	readonly tight: boolean;
	readonly bodyPadding: number;
}

export interface TranscriptTool extends Component {
	readonly transcriptRole: "tool";
	setTranscriptLayout(layout: TranscriptToolLayout): void;
}

type TranscriptRole = (TranscriptMessage | TranscriptTool)["transcriptRole"];

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
		let tools: TranscriptTool[] = [];
		const endToolGroup = () => {
			tools.forEach((tool, index) => {
				tool.setTranscriptLayout({ index, groupSize: tools.length, tight, bodyPadding });
			});
			tools = [];
		};

		for (const child of this.children) {
			const role = transcriptRole(child);
			if (role === "tool") {
				tools.push(child as TranscriptTool);
			} else if (role === undefined) {
				endToolGroup();
				speaker = undefined;
			} else {
				const message = child as TranscriptMessage;
				const showHeader = role === "user" || speaker !== "pi";
				message.setTranscriptLayout({ showHeader, tight, headerPadding, bodyPadding });
				speaker = role;
				if (!message.isEmpty) endToolGroup();
			}
		}
		endToolGroup();

		return super.render(width);
	}
}

function transcriptRole(child: Component): TranscriptRole | undefined {
	return "transcriptRole" in child ? (child as TranscriptMessage | TranscriptTool).transcriptRole : undefined;
}
