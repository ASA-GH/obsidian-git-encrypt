import { App, PluginSettingTab } from "obsidian";
import type GitEncryptPlugin from "../main";
import { renderRepositorySection } from "./sections/repository";
import { renderAuthenticationSection } from "./sections/authentication";
import { renderAuthorSection } from "./sections/author";
import { renderMasterKeySection } from "./sections/masterKey";
import { renderAdvancedSection } from "./sections/advanced";

export type { GitEncryptSettings } from "./types";
export { DEFAULT_SETTINGS } from "./defaults";

/**
 * Interface tab for managing Git Encrypt plugin settings within Obsidian.
 * Orchestrates modular rendering across repository, authentication, author,
 * encryption keys, and advanced automation sections.
 */
export class GitEncryptSettingTab extends PluginSettingTab {
	plugin: GitEncryptPlugin;

	constructor(app: App, plugin: GitEncryptPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	/**
	 * Renders the entire settings user interface.
	 * Clears the existing container view and cascades asynchronous injection
	 * for each logical settings section.
	 */
	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		void this.renderSections(containerEl);
	}

	/**
	 * Sequentially executes asynchronous rendering functions for each setting sub-section.
	 *
	 * @param containerEl - The parent HTML element where the sections will be rendered.
	 */
	private async renderSections(containerEl: HTMLElement): Promise<void> {
		try {
			await renderRepositorySection(containerEl, this.plugin);
			await renderAuthenticationSection(containerEl, this.plugin);
			await renderAuthorSection(containerEl, this.plugin);
			await renderMasterKeySection(containerEl, this.plugin, this.app);
			await renderAdvancedSection(containerEl, this.plugin, this.app);
		} catch (error) {
			console.error(
				"Failed to render Git Encrypt settings sections:",
				error,
			);
		}
	}
}
