import { Box, Container, Markdown, type MarkdownTheme, MouseRegion, Text } from "@earendil-works/pi-tui";
import type { ParsedSkillBlock } from "../../../core/agent-session.ts";
import { getMarkdownTheme, theme } from "../theme/theme.ts";
import { keyText } from "./keybinding-hints.ts";

/**
 * Component that renders the skills loaded for a message with collapsed/expanded state.
 * Uses same background color as custom messages for visual consistency.
 * Only renders the skill blocks themselves - user message is rendered separately.
 */
export class SkillInvocationMessageComponent extends Box {
	private expanded = false;
	private skills: readonly ParsedSkillBlock[];
	private markdownTheme: MarkdownTheme;

	constructor(skills: readonly ParsedSkillBlock[], markdownTheme: MarkdownTheme = getMarkdownTheme(), outputPad = 1) {
		super(outputPad, 1, (t) => theme.bg("customMessageBg", t));
		this.skills = skills;
		this.markdownTheme = markdownTheme;
		this.updateDisplay();
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
		this.updateDisplay();
	}

	setOutputPad(outputPad: number): void {
		this.setPaddingX(outputPad);
	}

	override invalidate(): void {
		super.invalidate();
		this.updateDisplay();
	}

	private updateDisplay(): void {
		this.clear();
		const content = new Container();

		if (this.expanded) {
			// Expanded: label + each skill's name header and full content
			const label = theme.fg("customMessageLabel", `\x1b[1m[skill]\x1b[22m`);
			content.addChild(new Text(label, 0, 0));
			const markdown = this.skills.map((skill) => `**${skill.name}**\n\n${skill.content}`).join("\n\n");
			content.addChild(
				new Markdown(markdown, 0, 0, this.markdownTheme, {
					color: (text: string) => theme.fg("customMessageText", text),
				}),
			);
		} else {
			// Collapsed: single line - [skill] names (hint to expand)
			const line =
				theme.fg("customMessageLabel", `\x1b[1m[skill]\x1b[22m `) +
				theme.fg("customMessageText", this.skills.map((skill) => skill.name).join(" · ")) +
				theme.fg("dim", ` (${keyText("app.tools.expand")} to expand)`);
			content.addChild(new Text(line, 0, 0));
		}

		this.addChild(
			new MouseRegion(content, (event) => {
				if (event.type !== "click" || event.button !== "left") return undefined;
				this.setExpanded(!this.expanded);
				return { handled: true };
			}),
		);
	}
}
