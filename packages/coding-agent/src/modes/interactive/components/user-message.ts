import { Container, Markdown, type MarkdownTheme } from "@earendil-works/pi-tui";
import type { MarkdownTransformer } from "../../../core/extensions/types.ts";
import { getMarkdownTheme, theme } from "../theme/theme.ts";
import { MessageSeparator, SpeakerHeader } from "../transcript/message-chrome.ts";
import type { TranscriptLayout, TranscriptMessage } from "../transcript/transcript-container.ts";
import { createMarkdownTransform } from "./markdown-transform.ts";

const OSC133_ZONE_START = "\x1b]133;A\x07";
const OSC133_ZONE_END = "\x1b]133;B\x07";
const OSC133_ZONE_FINAL = "\x1b]133;C\x07";

/**
 * Component that renders a user message
 */
export class UserMessageComponent extends Container implements TranscriptMessage {
	readonly transcriptRole = "user";
	readonly isEmpty = false;
	private text: string;
	private markdownTheme: MarkdownTheme;
	private outputPad: number;
	private markdownTransformers: readonly MarkdownTransformer[];
	private messageId?: string;
	private timestamp?: string;
	private sentAt?: number;
	private transcriptLayout?: TranscriptLayout;
	private readonly header = new SpeakerHeader("You");
	private readonly separator = new MessageSeparator();

	constructor(
		text: string,
		markdownTheme: MarkdownTheme = getMarkdownTheme(),
		outputPad = 1,
		markdownTransformers: readonly MarkdownTransformer[] = [],
		messageId?: string,
		timestamp?: string,
		sentAt?: number,
	) {
		super();
		this.text = text;
		this.markdownTheme = markdownTheme;
		this.outputPad = outputPad;
		this.markdownTransformers = markdownTransformers;
		this.messageId = messageId;
		this.timestamp = timestamp;
		this.sentAt = sentAt;
		this.rebuild();
	}

	setOutputPad(padding: number): void {
		this.outputPad = padding;
		this.rebuild();
	}

	setTranscriptLayout(layout: TranscriptLayout): void {
		const firstLayout = this.transcriptLayout === undefined;
		this.transcriptLayout = layout;
		this.header.update({
			visible: layout.showHeader,
			leadingBlank: false,
			padding: layout.headerPadding,
			timestamp: this.sentAt,
		});
		this.separator.setPadding(layout.bodyPadding);

		if (firstLayout || layout.bodyPadding !== this.outputPad) {
			this.setOutputPad(layout.bodyPadding);
		}
	}

	private rebuild(): void {
		this.clear();
		const inTranscript = this.transcriptLayout !== undefined;
		if (inTranscript) this.addChild(this.header);
		// The Markdown pads and colors its own background: a Box around it would keep a second full-width copy of every
		// line, with identical output.
		this.addChild(
			new Markdown(
				this.text,
				this.outputPad,
				inTranscript ? 0 : 1,
				this.markdownTheme,
				{
					color: (content: string) => theme.fg("userMessageText", content),
					bgColor: inTranscript ? undefined : (content: string) => theme.bg("userMessageBg", content),
				},
				{
					preserveOrderedListMarkers: true,
					preserveBackslashEscapes: true,
					transform: createMarkdownTransform(
						"user",
						() => false,
						this.markdownTransformers,
						this.messageId,
						this.timestamp,
					),
				},
			),
		);
		if (inTranscript) this.addChild(this.separator);
	}

	override render(width: number): string[] {
		const lines = super.render(width);
		if (lines.length === 0) {
			return lines;
		}

		lines[0] = OSC133_ZONE_START + lines[0];
		lines[lines.length - 1] = OSC133_ZONE_END + OSC133_ZONE_FINAL + lines[lines.length - 1];
		return lines;
	}
}
