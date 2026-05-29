import { App, PluginSettingTab, Setting } from "obsidian";
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
	async display(): Promise<void> {
		const { containerEl } = this;
		containerEl.empty();

		new Setting(containerEl).setName("Git Encrypt Settings").setHeading();

		await renderRepositorySection(containerEl, this.plugin);
		await renderAuthenticationSection(containerEl, this.plugin);
		await renderAuthorSection(containerEl, this.plugin);
		await renderMasterKeySection(containerEl, this.plugin);
		await renderAdvancedSection(containerEl, this.plugin);
	}
}
