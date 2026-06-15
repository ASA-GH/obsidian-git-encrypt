import { App, Setting } from "obsidian";
import type GitEncryptPlugin from "../../main";
import { createSettingGroup } from "../ui";

/**
 * Renders advanced automation and synchronization settings.
 * Configures background auto-sync intervals, file exclusion logic (glob patterns),
 * startup/shutdown triggers, and merge conflict resolution strategies.
 *
 * @param containerEl - The parent HTML element where the section will be rendered.
 * @param plugin - The main plugin instance containing settings and helper methods.
 * @param app - The global Obsidian application instance used to access vault configuration.
 */
export async function renderAdvancedSection(
	containerEl: HTMLElement,
	plugin: GitEncryptPlugin,
	app: App,
): Promise<void> {
	const itemEl = createSettingGroup(containerEl, "Advanced settings");

	new Setting(itemEl)
		.setName("Auto pull on startup")
		.setDesc(
			"Automatically pull remote repository changes when Obsidian opens.",
		)
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.autoPullOnStart)
				.onChange(async (val) => {
					plugin.settings.autoPullOnStart = val;
					await plugin.saveSettings();
				}),
		);

	new Setting(itemEl)
		.setName("Auto push on exit")
		.setDesc(
			"Automatically push local repository changes when Obsidian closes.",
		)
		.addToggle((toggle) =>
			toggle
				.setValue(plugin.settings.autoPushOnClose)
				.onChange(async (val) => {
					plugin.settings.autoPushOnClose = val;
					await plugin.saveSettings();
				}),
		);

	new Setting(itemEl)
		.setName("Sync interval (minutes)")
		.setDesc(
			"Set background sync frequency. Enter 0 to disable automatic synchronization.",
		)
		.addText((text) =>
			text
				.setValue(String(plugin.settings.syncIntervalMinutes))
				.onChange(async (val) => {
					const num = Number.parseInt(val.trim(), 10);
					if (!Number.isNaN(num)) {
						plugin.settings.syncIntervalMinutes = num;
						await plugin.saveSettings();
					}
				}),
		);

	new Setting(itemEl)
		.setName("Exclude patterns")
		.setDesc(
			"Comma-separated list of files or folders to skip during encryption (supports glob patterns).",
		)
		.addTextArea((text) =>
			text
				.setPlaceholder(
					`Example: .git, ${app.vault.configDir}, temp.md`,
				)
				.setValue(plugin.settings.excludePatterns)
				.onChange(async (val) => {
					plugin.settings.excludePatterns = val.trim();
					await plugin.saveSettings();
				}),
		);

	new Setting(itemEl)
		.setName("Merge conflict resolution strategy")
		.setDesc(
			"Define the default behavior when a merge conflict occurs during synchronization.",
		)
		.addDropdown((dropdown) =>
			dropdown
				.addOption("ask", "Ask user")
				.addOption("abort", "Abort sync operation")
				.addOption(
					"theirs",
					"Overwrite local with remote version (theirs)",
				)
				.addOption(
					"ours",
					"Keep local version and overwrite remote (ours)",
				)
				.setValue(plugin.settings.conflictAction)
				.onChange(async (val: "ask" | "abort" | "theirs" | "ours") => {
					plugin.settings.conflictAction = val;
					await plugin.saveSettings();
				}),
		);
}
