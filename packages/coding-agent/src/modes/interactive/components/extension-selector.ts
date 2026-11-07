/**
 * Generic selector component for extensions.
 * Displays a list of string options with keyboard navigation.
 */

import { Container, getKeybindings, Spacer, type TUI } from "@earendil-works/pi-tui";
import { theme } from "../theme/theme.ts";
import { CountdownTimer } from "./countdown-timer.ts";
import { DialogBorder, dialogHeading, ExtensionDialog } from "./extension-dialog.ts";
import { keyHint, rawKeyHint } from "./keybinding-hints.ts";
import { ThemedText } from "./themed-text.ts";

export interface ExtensionSelectorOptions {
	tui?: TUI;
	timeout?: number;
	onToggleToolsExpanded?: () => void;
	description?: string;
}

const MIN_VISIBLE_OPTIONS = 5;
const VISIBLE_OPTIONS_SHARE = 0.3;

export class ExtensionSelectorComponent extends ExtensionDialog {
	private options: string[];
	private selectedIndex = 0;
	private scrollOffset = 0;
	private shownCount = 0;
	private listContainer: Container;
	private tui: TUI | undefined;
	private onSelectCallback: (option: string) => void;
	private onCancelCallback: () => void;
	private titleText: ThemedText;
	private title: string;
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
		this.tui = opts?.tui;
		this.onSelectCallback = onSelect;
		this.onCancelCallback = onCancel;
		this.onToggleToolsExpanded = opts?.onToggleToolsExpanded;
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

		this.listContainer = new Container();
		this.addChild(this.listContainer);
		this.addChild(new Spacer(1));
		this.addChild(
			new ThemedText(
				() =>
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

	override render(width: number): string[] {
		if (this.visibleCount() !== this.shownCount) this.updateList();
		return super.render(width);
	}

	private visibleCount(): number {
		const rows = this.tui?.terminal.rows;
		const count =
			rows === undefined
				? this.options.length
				: Math.max(MIN_VISIBLE_OPTIONS, Math.floor(rows * VISIBLE_OPTIONS_SHARE));
		return Math.min(count, this.options.length);
	}

	private updateList(): void {
		const count = this.visibleCount();
		const lowest = Math.max(0, this.selectedIndex - count + 1);
		this.scrollOffset = Math.min(
			Math.max(this.scrollOffset, lowest),
			this.selectedIndex,
			this.options.length - count,
		);
		this.shownCount = count;

		this.listContainer.clear();
		for (let i = this.scrollOffset; i < this.scrollOffset + count; i++) {
			const option = this.options[i] ?? "";
			const text =
				i === this.selectedIndex
					? () => theme.fg("accent", "◆ ") + theme.fg("text", theme.bold(option))
					: () => theme.fg("muted", "◇ ") + theme.fg("text", option);
			this.listContainer.addChild(new ThemedText(text, 0, 0));
		}

		if (count < this.options.length) {
			const position = `(${this.selectedIndex + 1}/${this.options.length})`;
			this.listContainer.addChild(new ThemedText(() => theme.fg("muted", position), 0, 0));
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
