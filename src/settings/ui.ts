/**
 * Creates a structured setting group with a stylized heading.
 *
 * @param containerEl - The parent HTML element where the group will be appended.
 * @param title - The display text for the group heading.
 * @returns The container element (`.setting-items`) where individual `Setting` instances should be rendered.
 */
export function createSettingGroup(
	containerEl: HTMLElement,
	title: string,
): HTMLElement {
	const groupEl = containerEl.createDiv({ cls: "setting-group" });
	const headingEL = groupEl.createDiv({
		cls: "setting-item setting-item-heading",
	});

	headingEL.createDiv({ cls: "setting-item-name", text: title });
	headingEL.createDiv({ cls: "setting-item-control" });

	return groupEl.createDiv({ cls: "setting-items" });
}
