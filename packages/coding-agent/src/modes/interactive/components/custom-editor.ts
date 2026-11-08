import {
	Editor,
	type EditorOptions,
	type EditorTheme,
	stripTerminalSequences,
	type TUI,
	type TuiMouseEvent,
	type TuiMouseEventResult,
	truncateToWidth,
	visibleWidth,
} from "@earendil-works/pi-tui";
import type { AppKeybinding, KeybindingsManager } from "../../../core/keybindings.ts";
import { theme } from "../theme/theme.ts";

const BOX_MIN_WIDTH = 12;
const BOX_LEFT = 4;
const BOX_FRAME = BOX_LEFT + 1;

/**
 * Custom editor that handles app-level keybindings for coding-agent.
 */
export class CustomEditor extends Editor {
	private keybindings: KeybindingsManager;
	public actionHandlers: Map<AppKeybinding, () => void> = new Map();

	// Special handlers that can be dynamically replaced
	public onEscape?: () => void;
	public onCtrlD?: () => void;
	public onPasteImage?: () => void;
	/** Handler for extension-registered shortcuts. Returns true if handled. */
	public onExtensionShortcut?: (data: string) => boolean;
	public badges?: (budget: number) => string;

	constructor(tui: TUI, editorTheme: EditorTheme, keybindings: KeybindingsManager, options?: EditorOptions) {
		super(tui, editorTheme, options);
		this.keybindings = keybindings;
	}

	protected override maxVisibleLines(): number {
		return Math.max(5, Math.floor(this.tui.terminal.rows * 0.4));
	}

	override render(width: number): string[] {
		if (width < BOX_MIN_WIDTH) return super.render(width);

		const lines = super.render(width - BOX_FRAME);
		const bottom = this.renderedVisibleLineCount + 1;
		const prompt = ` ${theme.fg("accent", "◆")} `;
		const side = this.borderStyle("│");

		return [
			this.renderBoxTop(lines[0]!, width),
			...lines.slice(1, bottom).map((line, index) => side + (index === 0 ? prompt : "   ") + line + side),
			this.borderStyle("╰───") + lines[bottom] + this.borderStyle("╯"),
			...lines.slice(bottom + 1).map((line) => " ".repeat(BOX_LEFT) + line),
		];
	}

	private renderBoxTop(rule: string, width: number): string {
		const ruleLabelWidth = visibleWidth(stripTerminalSequences(rule).replace(/─+$/, ""));
		const badges = this.badges?.(width - ruleLabelWidth - 8) ?? "";
		if (!badges) return this.borderStyle("╭───") + rule + this.borderStyle("╮");

		const left = truncateToWidth(this.borderStyle("╭───") + rule, width - visibleWidth(badges) - 5, "");
		return `${left} ${badges} ${this.borderStyle("──╮")}`;
	}

	override handleMouse(event: TuiMouseEvent): TuiMouseEventResult | undefined {
		if (event.width < BOX_MIN_WIDTH) return super.handleMouse(event);
		return super.handleMouse({ ...event, x: event.x - BOX_LEFT, width: event.width - BOX_FRAME });
	}

	/**
	 * Register a handler for an app action.
	 */
	onAction(action: AppKeybinding, handler: () => void): void {
		this.actionHandlers.set(action, handler);
	}

	handleInput(data: string): void {
		// Check extension-registered shortcuts first
		if (this.onExtensionShortcut?.(data)) {
			return;
		}

		// Selection page keys move an open autocomplete menu before app actions run.
		// This lets users bind Ctrl+V even though it pastes images by default.
		if (
			this.isShowingAutocomplete() &&
			(this.keybindings.matches(data, "tui.select.pageUp") || this.keybindings.matches(data, "tui.select.pageDown"))
		) {
			super.handleInput(data);
			return;
		}

		// Check for clipboard paste keybinding
		if (this.keybindings.matches(data, "app.clipboard.pasteImage")) {
			this.onPasteImage?.();
			return;
		}

		// Check app keybindings first

		// Escape/interrupt - only if autocomplete is NOT active
		if (this.keybindings.matches(data, "app.interrupt")) {
			if (!this.isShowingAutocomplete()) {
				// Use dynamic onEscape if set, otherwise registered handler
				const handler = this.onEscape ?? this.actionHandlers.get("app.interrupt");
				if (handler) {
					handler();
					return;
				}
			}
			// Let parent handle escape for autocomplete cancellation
			super.handleInput(data);
			return;
		}

		// Exit (Ctrl+D) - only when editor is empty
		if (this.keybindings.matches(data, "app.exit")) {
			if (this.getText().length === 0) {
				const handler = this.onCtrlD ?? this.actionHandlers.get("app.exit");
				if (handler) handler();
				return;
			}
			// Fall through to editor handling for delete-char-forward when not empty
		}

		// Explicit history bindings take precedence over app actions while the editor is focused.
		// This lets users bind Ctrl+P even though it cycles models by default.
		if (
			this.keybindings.matches(data, "tui.editor.historyPrevious") ||
			this.keybindings.matches(data, "tui.editor.historyNext")
		) {
			super.handleInput(data);
			return;
		}

		// Check all other app actions
		for (const [action, handler] of this.actionHandlers) {
			if (action !== "app.interrupt" && action !== "app.exit" && this.keybindings.matches(data, action)) {
				handler();
				return;
			}
		}

		// Pass to parent for editor handling
		super.handleInput(data);
	}
}
