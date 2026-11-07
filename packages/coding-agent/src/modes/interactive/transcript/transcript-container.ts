import { type Component, Container } from "@earendil-works/pi-tui";

export interface TranscriptLayout {
	readonly showHeader: boolean;
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
	readonly bodyPadding: number;
}

export interface TranscriptTool extends Component {
	readonly transcriptRole: "tool";
	setTranscriptLayout(layout: TranscriptToolLayout): void;
}

type TranscriptRole = (TranscriptMessage | TranscriptTool)["transcriptRole"];

export const NARROW_WIDTH = 80;

export class TranscriptContainer extends Container {
	private readonly getPadding: () => number;

	constructor(getPadding: () => number) {
		super();
		this.getPadding = getPadding;
	}

	override render(width: number): string[] {
		const headerPadding = this.getPadding();
		const bodyPadding = width < NARROW_WIDTH ? 1 : headerPadding + 2;

		let speaker: "user" | "pi" | undefined;
		let tools: TranscriptTool[] = [];
		const endToolGroup = () => {
			tools.forEach((tool, index) => {
				tool.setTranscriptLayout({ index, groupSize: tools.length, bodyPadding });
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
				message.setTranscriptLayout({ showHeader, headerPadding, bodyPadding });
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
