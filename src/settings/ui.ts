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

/**
 * Renders an info callout block inside a setting group container.
 *
 * @param containerEl - The parent element to append the callout to.
 * @param title - The callout title text.
 * @param content - The callout body text.
 */
export function renderCallout(
	containerEl: HTMLElement,
	title: string,
	content: string,
): void {
	const el = containerEl.createDiv({
		cls: "callout callout-info",
		attr: { role: "note" },
	});
	const iconEl = el.createDiv({ cls: "callout-icon" });
	const svgEl = iconEl.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "svg"));
	svgEl.setAttribute("viewBox", "0 0 24 24");
	svgEl.setAttribute("fill", "currentColor");
	const pathEl = svgEl.appendChild(document.createElementNS("http://www.w3.org/2000/svg", "path"));
	pathEl.setAttribute("d", "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z");
	el.createDiv({ cls: "callout-title", text: title });
	el.createDiv({ cls: "callout-content", text: content });
}
