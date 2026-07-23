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

	// Sync explanation — clarifies what git-remote-crypto does on push/pull.
	const syncCalloutEl = itemEl.createDiv({
		cls: "callout callout-info",
		attr: { role: "note" },
	});
	syncCalloutEl.createDiv({ cls: "callout-icon" }).innerHTML =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
	syncCalloutEl.createDiv({
		cls: "callout-title",
		text: "How sync works",
	});
	syncCalloutEl.createDiv({
		cls: "callout-content",
		text: "On push, git-remote-crypto encrypts every note before sending it to the remote. On pull, it decrypts encrypted blobs back into readable notes. On the first push, all notes are encrypted and uploaded — the remote will contain only ciphertext. Make sure to back up your vault before the first sync.",
	});

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
