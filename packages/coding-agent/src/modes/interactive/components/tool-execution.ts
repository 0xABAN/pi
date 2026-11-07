import {
	Box,
	type Component,
	Container,
	getCapabilities,
	Image,
	MouseRegion,
	Spacer,
	Text,
	type TUI,
	type TuiMouseEvent,
} from "@earendil-works/pi-tui";
import type { ToolDefinition, ToolRenderContext, ToolRenderers, ToolSummary } from "../../../core/extensions/types.ts";

/** What this component needs from a tool: how to draw it, without executing it. */
export type { ToolRenderers };

import { formatToolCallWithArgs, getTextOutput as getRenderedTextOutput } from "../../../core/tools/render-utils.ts";
import { ensurePngTranscoder } from "../../../utils/image-convert.ts";
import { theme } from "../theme/theme.ts";
import {
	genericToolSummary,
	renderToolRow,
	type ToolBranch,
	type ToolRowState,
	toolBranch,
} from "../transcript/tool-row.ts";
import type { TranscriptTool, TranscriptToolLayout } from "../transcript/transcript-container.ts";
import { keyHint, keyText } from "./keybinding-hints.ts";

const FALLBACK_PREVIEW_LINES = 10;

export interface ToolExecutionOptions {
	showImages?: boolean;
	imageWidthCells?: number;
	outputPad?: number;
}

export class ToolExecutionComponent extends Container implements TranscriptTool {
	readonly transcriptRole = "tool";
	private contentBox: Box;
	private contentText: Text;
	private contentTextRegion: MouseRegion;
	private selfRenderContainer: Container;
	private selfRenderTop = 1;
	private selfRenderHeight = 0;
	private callRendererComponent?: Component;
	private resultRendererComponent?: Component;
	private rendererState: any = {};
	private imageComponents: Image[] = [];
	/** Inputs of imageComponents, so updateDisplay can reuse images and keep their converted PNG data. */
	private imageSources: Array<{ data: string; mimeType: string; widthCells: number }> = [];
	private imageSpacers: Spacer[] = [];
	private toolName: string;
	private toolCallId: string;
	private args: any;
	private expanded = false;
	private showImages: boolean;
	private imageWidthCells: number;
	private outputPad: number;
	private isPartial = true;
	private toolDefinition?: ToolRenderers;
	private ui: TUI;
	private cwd: string;
	private executionStarted = false;
	private argsComplete = false;
	/** `updateArgs()` ran since the last display update; the next render applies it. */
	private argsPending = false;
	private result?: {
		content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
		isError: boolean;
		details?: any;
		durationMs?: number;
	};
	private hideComponent = false;
	private readonly outputGap = new Spacer(1);
	private transcriptLayout?: TranscriptToolLayout;
	private transcriptIndent = "";
	private branch?: ToolBranch;
	private outputPrefix = "";
	private readonly transcriptView = new Container();
	private revision = 0;
	private rowCache?: { width: number; revision: number; lines: string[] };

	constructor(
		toolName: string,
		toolCallId: string,
		args: any,
		options: ToolExecutionOptions = {},
		toolDefinition: ToolRenderers | ToolDefinition<any, any, any> | undefined,
		ui: TUI,
		cwd: string,
	) {
		super();
		this.toolName = toolName;
		this.toolCallId = toolCallId;
		this.args = args;
		this.toolDefinition = toolDefinition;
		this.showImages = options.showImages ?? true;
		this.imageWidthCells = options.imageWidthCells ?? 60;
		this.outputPad = options.outputPad ?? 1;
		this.ui = ui;
		this.cwd = cwd;

		this.addChild(this.outputGap);

		// Always create all shell variants. contentBox is used for default renderer-based composition.
		// selfRenderContainer is used when the tool renders its own framing.
		// contentText is reserved for generic fallback rendering when no tool definition exists.
		this.contentBox = new Box(1, 1, (text: string) => theme.bg("toolPendingBg", text));
		this.contentText = new Text("", 1, 1, (text: string) => theme.bg("toolPendingBg", text));
		this.contentTextRegion = this.createResultRegion(this.contentText);
		this.selfRenderContainer = new Container();

		if (this.hasRendererDefinition()) {
			this.addChild(this.getRenderShell() === "self" ? this.selfRenderContainer : this.contentBox);
		} else {
			this.addChild(this.contentTextRegion);
		}

		this.transcriptView.addChild({ render: () => this.renderGroupStart(), invalidate: () => {} });
		this.transcriptView.addChild(
			new MouseRegion({ render: (width) => this.renderRow(width), invalidate: () => {} }, (event) => {
				if (event.type !== "click" || event.button !== "left") return undefined;
				this.setExpanded(!this.expanded);
				return { handled: true };
			}),
		);
		this.transcriptView.addChild({
			render: (width) => this.renderOutput(width),
			handleMouse: (event) => this.handleOutputMouse(event),
			invalidate: () => {},
		});

		this.updateDisplay();
	}

	setTranscriptLayout(layout: TranscriptToolLayout): void {
		const previous = this.transcriptLayout;
		this.transcriptLayout = layout;
		this.outputGap.setLines(0);
		if (
			previous?.index === layout.index &&
			previous.groupSize === layout.groupSize &&
			previous.bodyPadding === layout.bodyPadding
		) {
			return;
		}

		this.transcriptIndent = " ".repeat(layout.bodyPadding);
		this.branch = toolBranch(layout.index, layout.groupSize);
		this.outputPrefix = this.branch ? this.transcriptIndent + this.branch.output : "";
		this.revision++;

		const outputPad = this.branch ? 1 : layout.bodyPadding;
		if (outputPad !== this.outputPad) this.setOutputPad(outputPad);
	}

	private getCallRenderer(): ToolDefinition<any, any>["renderCall"] | undefined {
		return this.toolDefinition?.renderCall;
	}

	private getResultRenderer(): ToolDefinition<any, any>["renderResult"] | undefined {
		return this.toolDefinition?.renderResult;
	}

	private hasRendererDefinition(): boolean {
		return this.toolDefinition !== undefined;
	}

	private getRenderShell(): "default" | "self" {
		return this.toolDefinition?.renderShell ?? "default";
	}

	private getRenderContext(lastComponent: Component | undefined): ToolRenderContext {
		return {
			args: this.args,
			toolCallId: this.toolCallId,
			invalidate: () => {
				this.invalidate();
				this.ui.requestRender();
			},
			lastComponent,
			state: this.rendererState,
			cwd: this.cwd,
			executionStarted: this.executionStarted,
			argsComplete: this.argsComplete,
			isPartial: this.isPartial,
			expanded: this.expanded,
			showImages: this.showImages,
			isError: this.result?.isError ?? false,
			durationMs: this.isPartial ? undefined : this.result?.durationMs,
			outputPad: this.outputPad,
			keyText,
			keyHint,
		};
	}

	private createCallFallback(): Component {
		return new Text(formatToolCallWithArgs(this.toolName, this.args, theme, this.expanded), 0, 0);
	}

	private createResultFallback(): Component | undefined {
		const output = this.getTextOutput();
		if (!output) {
			return undefined;
		}

		const lines = output.split("\n");
		const displayLines = this.expanded ? lines : lines.slice(0, FALLBACK_PREVIEW_LINES);
		const remaining = lines.length - displayLines.length;
		let text = displayLines.map((line) => theme.fg("toolOutput", line)).join("\n");
		if (remaining > 0) {
			text += `${theme.fg("muted", `\n... (${remaining} more lines,`)} ${keyHint("app.tools.expand", "to expand")}${theme.fg("muted", ")")}`;
		}
		return new Text(text, 0, 0);
	}

	private createResultRegion(component: Component): MouseRegion {
		return new MouseRegion(component, (event) => {
			if (!this.result || event.type !== "click" || event.button !== "left") return undefined;
			this.setExpanded(!this.expanded);
			return { handled: true };
		});
	}

	/**
	 * Show new partial arguments. Applied at the next render, so a call streaming many argument deltas between two
	 * frames runs its renderer once per frame, not once per delta (#9265).
	 */
	updateArgs(args: any): void {
		this.args = args;
		this.argsPending = true;
		this.ui.requestRender();
	}

	markExecutionStarted(): void {
		this.executionStarted = true;
		this.updateDisplay();
		this.ui.requestRender();
	}

	setArgsComplete(): void {
		this.argsComplete = true;
		this.updateDisplay();
		this.ui.requestRender();
	}

	updateResult(
		result: {
			content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
			details?: any;
			isError: boolean;
			/** Execution time of a final result. */
			durationMs?: number;
		},
		isPartial = false,
	): void {
		this.result = result;
		this.isPartial = isPartial;
		this.updateDisplay();
	}

	setExpanded(expanded: boolean): void {
		this.expanded = expanded;
		this.updateDisplay();
	}

	setOutputPad(outputPad: number): void {
		this.outputPad = outputPad;
		this.updateDisplay();
	}

	setShowImages(show: boolean): void {
		this.showImages = show;
		this.updateDisplay();
	}

	setImageWidthCells(width: number): void {
		this.imageWidthCells = Math.max(1, Math.floor(width));
		this.updateDisplay();
	}

	override invalidate(): void {
		super.invalidate();
		this.updateDisplay();
	}

	override render(width: number): string[] {
		if (this.argsPending) this.updateDisplay();
		return this.transcriptLayout ? this.transcriptView.render(width) : this.renderBlock(width);
	}

	private renderBlock(width: number): string[] {
		if (this.hideComponent) {
			return [];
		}

		if (this.hasRendererDefinition() && this.getRenderShell() === "self") {
			const contentLines = this.selfRenderContainer.render(width);
			this.selfRenderHeight = contentLines.length;
			if (contentLines.length === 0 && this.imageComponents.length === 0) {
				return [];
			}

			const lines: string[] = [];
			if (contentLines.length > 0) {
				lines.push(...this.outputGap.render(width));
				this.selfRenderTop = lines.length;
				lines.push(...contentLines);
			}
			lines.push(...this.renderImages(width));
			return lines;
		}

		return super.render(width);
	}

	private renderImages(width: number): string[] {
		const lines: string[] = [];
		for (let i = 0; i < this.imageComponents.length; i++) {
			const spacer = this.imageSpacers[i];
			if (spacer) {
				lines.push(...spacer.render(width));
			}
			const imageComponent = this.imageComponents[i];
			if (imageComponent) {
				lines.push(...imageComponent.render(width));
			}
		}
		return lines;
	}

	private renderGroupStart(): string[] {
		const layout = this.transcriptLayout;
		if (layout?.index !== 0) return [];
		if (layout.groupSize < 2) return [""];
		return ["", this.transcriptIndent + theme.fg("muted", `${layout.groupSize} actions`)];
	}

	private renderRow(width: number): string[] {
		if (this.rowCache?.width === width && this.rowCache.revision === this.revision) return this.rowCache.lines;

		const indent = this.transcriptIndent;
		const lines = renderToolRow(this.summarize(), this.rowState(), width - indent.length, this.branch).map(
			(line) => indent + line,
		);
		this.rowCache = { width, revision: this.revision, lines };
		return lines;
	}

	private renderOutput(width: number): string[] {
		const outputWidth = width - this.outputPrefix.length;
		const lines = this.expanded ? this.renderBlock(outputWidth) : this.renderImages(outputWidth);
		if (!this.outputPrefix) return lines;

		const prefix = theme.fg("borderMuted", this.outputPrefix);
		return lines.map((line) => prefix + line);
	}

	private handleOutputMouse(event: TuiMouseEvent): ReturnType<Container["handleMouse"]> {
		if (!this.expanded) return undefined;

		const offset = this.outputPrefix.length;
		if (event.x < offset) return undefined;
		return this.handleBlockMouse({ ...event, x: event.x - offset, width: event.width - offset });
	}

	private summarize(): ToolSummary {
		return this.toolDefinition?.summarize?.(this.args) ?? genericToolSummary(this.toolName, this.args);
	}

	private rowState(): ToolRowState {
		const result = this.result;
		if (!result || this.isPartial) {
			return { status: this.executionStarted || result ? "running" : "waiting" };
		}
		if (result.isError) {
			const error = this.getTextOutput()
				.split("\n")
				.find((line) => line.trim());
			return { status: "failed", durationMs: result.durationMs, error };
		}
		return { status: "done", durationMs: result.durationMs };
	}

	override handleMouse(event: TuiMouseEvent): ReturnType<Container["handleMouse"]> {
		return this.transcriptLayout ? this.transcriptView.handleMouse(event) : this.handleBlockMouse(event);
	}

	private handleBlockMouse(event: TuiMouseEvent): ReturnType<Container["handleMouse"]> {
		if (!this.hasRendererDefinition() || this.getRenderShell() !== "self") return super.handleMouse(event);
		if (event.y < this.selfRenderTop || event.y >= this.selfRenderTop + this.selfRenderHeight) return undefined;
		return this.selfRenderContainer.handleMouse({
			...event,
			y: event.y - this.selfRenderTop,
			height: this.selfRenderHeight,
		});
	}

	private updateDisplay(): void {
		this.argsPending = false;
		this.revision++;
		const bgFn = this.isPartial
			? (text: string) => theme.bg("toolPendingBg", text)
			: this.result?.isError
				? (text: string) => theme.bg("toolErrorBg", text)
				: (text: string) => theme.bg("toolSuccessBg", text);

		let hasContent = false;
		this.hideComponent = false;
		if (this.hasRendererDefinition()) {
			const renderContainer = this.getRenderShell() === "self" ? this.selfRenderContainer : this.contentBox;
			if (renderContainer instanceof Box) {
				renderContainer.setBgFn(bgFn);
				renderContainer.setPaddingX(this.outputPad);
			}
			renderContainer.clear();

			const callRenderer = this.getCallRenderer();
			if (!callRenderer) {
				renderContainer.addChild(this.createResultRegion(this.createCallFallback()));
				hasContent = true;
			} else {
				try {
					const component = callRenderer(this.args, theme, this.getRenderContext(this.callRendererComponent));
					this.callRendererComponent = component;
					renderContainer.addChild(this.createResultRegion(component));
					hasContent = true;
				} catch {
					this.callRendererComponent = undefined;
					renderContainer.addChild(this.createResultRegion(this.createCallFallback()));
					hasContent = true;
				}
			}

			if (this.result) {
				const resultRenderer = this.getResultRenderer();
				if (!resultRenderer) {
					const component = this.createResultFallback();
					if (component) {
						renderContainer.addChild(this.createResultRegion(component));
						hasContent = true;
					}
				} else {
					try {
						const component = resultRenderer(
							{ content: this.result.content as any, details: this.result.details },
							{ expanded: this.expanded, isPartial: this.isPartial },
							theme,
							this.getRenderContext(this.resultRendererComponent),
						);
						this.resultRendererComponent = component;
						renderContainer.addChild(this.createResultRegion(component));
						hasContent = true;
					} catch {
						this.resultRendererComponent = undefined;
						const component = this.createResultFallback();
						if (component) {
							renderContainer.addChild(this.createResultRegion(component));
							hasContent = true;
						}
					}
				}
			}
		} else {
			this.contentText.setCustomBgFn(bgFn);
			this.contentText.setPaddingX(this.outputPad);
			this.contentText.setText(this.formatToolExecution());
			hasContent = true;
		}

		const previousImages = this.imageComponents;
		const previousSources = this.imageSources;
		for (const img of this.imageComponents) {
			this.removeChild(img);
		}
		this.imageComponents = [];
		this.imageSources = [];
		for (const spacer of this.imageSpacers) {
			this.removeChild(spacer);
		}
		this.imageSpacers = [];

		if (this.result) {
			const imageBlocks = this.result.content.filter((c) => c.type === "image");
			const caps = getCapabilities();
			for (const img of imageBlocks) {
				if (caps.images && this.showImages && img.data && img.mimeType) {
					const spacer = new Spacer(1);
					this.addChild(spacer);
					this.imageSpacers.push(spacer);
					const source = { data: img.data, mimeType: img.mimeType, widthCells: this.imageWidthCells };
					const index = this.imageComponents.length;
					const previous = previousSources[index];
					const imageComponent =
						previous?.data === source.data &&
						previous.mimeType === source.mimeType &&
						previous.widthCells === source.widthCells
							? previousImages[index]
							: new Image(
									source.data,
									source.mimeType,
									{ fallbackColor: (s: string) => theme.fg("toolOutput", s) },
									{ maxWidthCells: source.widthCells },
								);
					if (source.mimeType !== "image/png") {
						ensurePngTranscoder(() => {
							this.invalidate();
							this.ui.requestRender();
						});
					}
					this.imageComponents.push(imageComponent);
					this.imageSources.push(source);
					this.addChild(imageComponent);
				}
			}
		}

		if (this.hasRendererDefinition() && !hasContent && this.imageComponents.length === 0) {
			this.hideComponent = true;
		}
	}

	private getTextOutput(): string {
		return getRenderedTextOutput(this.result, this.showImages);
	}

	private formatToolExecution(): string {
		let text = theme.fg("toolTitle", theme.bold(this.toolName));
		const content = JSON.stringify(this.args, null, 2);
		if (content) {
			text += `\n\n${content}`;
		}
		const output = this.getTextOutput();
		if (output) {
			text += `\n${output}`;
		}
		return text;
	}
}
