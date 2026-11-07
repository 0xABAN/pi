/**
 * Simple text input component for extensions.
 */

import { type Focusable, getKeybindings, Input, Spacer, type TUI } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";
import { CountdownTimer } from "./countdown-timer.ts";
import { DialogBorder, dialogHeading, ExtensionDialog } from "./extension-dialog.ts";
import { keyHint } from "./keybinding-hints.ts";
import { ThemedText } from "./themed-text.ts";

export interface ExtensionInputOptions {
	tui?: TUI;
	timeout?: number;
	initialValue?: string;
	description?: string;
}

export class ExtensionInputComponent extends ExtensionDialog implements Focusable {
	private input: Input;
	private onSubmitCallback: (value: string) => void;
	private onCancelCallback: () => void;
	private titleText: ThemedText;
	private title: string;
	private baseTitle: string;
	private countdown: CountdownTimer | undefined;

	// Focusable implementation - propagate to input for IME cursor positioning
	private _focused = false;
	get focused(): boolean {
		return this._focused;
	}
	set focused(value: boolean) {
		this._focused = value;
		this.input.focused = value;
	}

	constructor(
		title: string,
		_placeholder: string | undefined,
		onSubmit: (value: string) => void,
		onCancel: () => void,
		opts?: ExtensionInputOptions,
	) {
		super();

		this.onSubmitCallback = onSubmit;
		this.onCancelCallback = onCancel;
		this.title = title;
		this.baseTitle = title;

		this.addChild(new DialogBorder("top"));
		this.addChild(new Spacer(1));

		this.titleText = new ThemedText(() => dialogHeading(this.title), 0, 0);
		this.addChild(this.titleText);
		const description = opts?.description;
		if (description) {
			this.addChild(new Spacer(1));
			this.addChild(new ThemedText(() => theme.fg("text", description), 0, 0));
		}
		this.addChild(new Spacer(1));

		if (opts?.timeout && opts.timeout > 0 && opts.tui) {
			this.countdown = new CountdownTimer(
				opts.timeout,
				opts.tui,
				(s) => {
					this.title = `${this.baseTitle} (${s}s)`;
					this.titleText.invalidate();
				},
				() => this.onCancelCallback(),
			);
		}

		this.input = new Input();
		if (opts?.initialValue) this.input.setValue(opts.initialValue);
		this.addChild(this.input);
		this.addChild(new Spacer(1));
		this.addChild(
			new ThemedText(
				() => `${keyHint("tui.select.confirm", "submit")}  ${keyHint("tui.select.cancel", "cancel")}`,
				0,
				0,
			),
		);
		this.addChild(new Spacer(1));
		this.addChild(new DialogBorder("bottom"));
	}

	handleInput(keyData: string): void {
		const kb = getKeybindings();
		if (kb.matches(keyData, "tui.select.confirm") || keyData === "\n") {
			this.onSubmitCallback(this.input.getValue());
		} else if (kb.matches(keyData, "tui.select.cancel")) {
			this.onCancelCallback();
		} else {
			this.input.handleInput(keyData);
		}
	}

	dispose(): void {
		this.countdown?.dispose();
	}
}
