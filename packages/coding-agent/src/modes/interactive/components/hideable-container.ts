import { Container } from "@earendil-works/pi-tui";

export class HideableContainer extends Container {
	private readonly isHidden: () => boolean;

	constructor(isHidden: () => boolean) {
		super();
		this.isHidden = isHidden;
	}

	override render(width: number): string[] {
		return this.isHidden() ? [] : super.render(width);
	}
}
