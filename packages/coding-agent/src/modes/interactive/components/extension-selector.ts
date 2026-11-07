/**
 * Generic selector component for extensions.
 * Displays a list of string options with keyboard navigation.
 */

import { Container, getKeybindings, Spacer, Text, type TUI } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";
import { CountdownTimer } from "./countdown-timer.ts";
import { DialogBorder, dialogHeading, ExtensionDialog } from "./extension-dialog.ts";
import { keyHint, rawKeyHint } from "./keybinding-hints.ts";

export interface ExtensionSelectorOptions {
	tui?: TUI;
	timeout?: number;
	onToggleToolsExpanded?: () => void;
	description?: string;
}

const MAX_VISIBLE_OPTIONS = 10;

export class ExtensionSelectorComponent extends ExtensionDialog {
	private options: string[];
	private selectedIndex = 0;
	private scrollOffset = 0;
	private listContainer: Container;
	private onSelectCallback: (option: string) => void;
	private onCancelCallback: () => void;
	private titleText: Text;
	private baseTitle: string;
	private countdown: CountdownTimer | undefined;
	private onToggleToolsExpanded: (() => void) | undefined;

	constructor(
		title: string,
		options: string[],
		onSelect: (option: string) => void,
		onCancel: () => void,
		opts?: ExtensionSelectorOptions,
	) {
		super();

		this.options = options;
		this.onSelectCallback = onSelect;
		this.onCancelCallback = onCancel;
		this.onToggleToolsExpanded = opts?.onToggleToolsExpanded;
		this.baseTitle = title;

		this.addChild(new DialogBorder("top"));
		this.addChild(new Spacer(1));

		this.titleText = new Text(dialogHeading(title), 0, 0);
		this.addChild(this.titleText);
		if (opts?.description) {
			this.addChild(new Spacer(1));
			this.addChild(new Text(theme.fg("text", opts.description), 0, 0));
		}
		this.addChild(new Spacer(1));

		if (opts?.timeout && opts.timeout > 0 && opts.tui) {
			this.countdown = new CountdownTimer(
				opts.timeout,
				opts.tui,
				(s) => this.titleText.setText(dialogHeading(`${this.baseTitle} (${s}s)`)),
				() => this.onCancelCallback(),
			);
		}

		this.listContainer = new Container();
		this.addChild(this.listContainer);
		this.addChild(new Spacer(1));
		this.addChild(
			new Text(
				rawKeyHint("↑↓", "navigate") +
					"  " +
					keyHint("tui.select.confirm", "select") +
					"  " +
					keyHint("tui.select.cancel", "cancel"),
				0,
				0,
			),
		);
		this.addChild(new Spacer(1));
		this.addChild(new DialogBorder("bottom"));

		this.updateList();
	}

	private updateList(): void {
		const count = Math.min(MAX_VISIBLE_OPTIONS, this.options.length);
		this.scrollOffset = Math.min(Math.max(this.scrollOffset, this.selectedIndex - count + 1), this.selectedIndex);

		this.listContainer.clear();
		this.options.slice(this.scrollOffset, this.scrollOffset + count).forEach((option, offset) => {
			const text =
				this.scrollOffset + offset === this.selectedIndex
					? theme.fg("accent", "◆ ") + theme.fg("text", theme.bold(option))
					: theme.fg("muted", "◇ ") + theme.fg("text", option);
			this.listContainer.addChild(new Text(text, 0, 0));
		});

		if (count < this.options.length) {
			const position = `(${this.selectedIndex + 1}/${this.options.length})`;
			this.listContainer.addChild(new Text(theme.fg("muted", position), 0, 0));
		}
	}

	handleInput(keyData: string): void {
		const kb = getKeybindings();
		if (kb.matches(keyData, "app.tools.expand")) {
			this.onToggleToolsExpanded?.();
		} else if (kb.matches(keyData, "tui.select.up") || keyData === "k") {
			this.selectedIndex = Math.max(0, this.selectedIndex - 1);
			this.updateList();
		} else if (kb.matches(keyData, "tui.select.down") || keyData === "j") {
			this.selectedIndex = Math.min(this.options.length - 1, this.selectedIndex + 1);
			this.updateList();
		} else if (kb.matches(keyData, "tui.select.confirm") || keyData === "\n") {
			const selected = this.options[this.selectedIndex];
			if (selected) this.onSelectCallback(selected);
		} else if (kb.matches(keyData, "tui.select.cancel")) {
			this.onCancelCallback();
		}
	}

	dispose(): void {
		this.countdown?.dispose();
	}
}
