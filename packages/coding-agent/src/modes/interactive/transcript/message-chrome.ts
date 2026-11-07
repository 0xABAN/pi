import type { Component } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";

export interface SpeakerHeaderState {
	readonly visible: boolean;
	readonly padding: number;
	readonly timestamp: number | undefined;
}

const TIME_FORMAT = new Intl.DateTimeFormat([], { hour: "2-digit", minute: "2-digit" });

export class SpeakerHeader implements Component {
	private readonly speaker: "You" | "Pi";
	private state: SpeakerHeaderState = { visible: false, padding: 0, timestamp: undefined };

	constructor(speaker: "You" | "Pi") {
		this.speaker = speaker;
	}

	get visible(): boolean {
		return this.state.visible;
	}

	update(state: SpeakerHeaderState): void {
		this.state = state;
	}

	render(): string[] {
		if (!this.state.visible) return [];

		const glyph = this.speaker === "You" ? theme.fg("accent", "◆") : theme.fg("warning", "●");
		let header = `${glyph} ${theme.bold(theme.fg("text", this.speaker))}`;
		if (this.state.timestamp !== undefined) {
			header += theme.fg("dim", ` · ${TIME_FORMAT.format(this.state.timestamp)}`);
		}

		const line = " ".repeat(this.state.padding) + header;
		return this.speaker === "Pi" ? ["", line] : [line];
	}

	invalidate(): void {}
}

export class MessageSeparator implements Component {
	private padding = 0;

	setPadding(padding: number): void {
		this.padding = padding;
	}

	render(width: number): string[] {
		return [" ".repeat(this.padding) + theme.fg("toolOutput", "─".repeat(width - 2 * this.padding))];
	}

	invalidate(): void {}
}
