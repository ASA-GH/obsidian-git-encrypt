import { Setting } from "obsidian";
import type GitEncryptPlugin from "../../main";
import { createSettingGroup } from "../ui";

/**
 * Renders the repository connection settings section.
 * Handles protocol selection, repository URL, branch, remote tracking name, and local storage path.
 *
 * @param containerEl - The parent HTML element where the section will be rendered.
 * @param plugin - The main plugin instance containing settings and helper methods.
 */
export async function renderRepositorySection(
	containerEl: HTMLElement,
	plugin: GitEncryptPlugin,
): Promise<void> {
	const itemEl = createSettingGroup(containerEl, "Repository connection");

	new Setting(itemEl)
		.setName("Transport protocol")
		.setDesc("Choose the access method for your remote Git repository.")
		.addDropdown((dropdown) =>
			dropdown
				.addOption("https", "HTTPS")
				.addOption("ssh", "SSH")
				.setValue(plugin.settings.transportType)
				.onChange(async (val: "https" | "ssh") => {
					plugin.settings.transportType = val;
					await plugin.saveSettings();
					await plugin.refreshSettingsTab();
				}),
		);

	new Setting(itemEl)
		.setName("Repository URL")
		.setDesc(
			plugin.settings.transportType === "ssh"
				? "SSH address (e.g., git@github.com:user/repo.git)"
				: "HTTPS address (e.g., https://github.com/user/repo.git)",
		)
		.addText((text) =>
			text
				.setPlaceholder(
					plugin.settings.transportType === "ssh"
						? "git@github.com:user/repo.git"
						: "https://github.com/user/repo.git",
				)
				.setValue(plugin.settings.repositoryUrl)
				.onChange(async (val) => {
					plugin.settings.repositoryUrl = val.trim();
					await plugin.saveSettings();
				}),
		);

	new Setting(itemEl)
		.setName("Branch")
		.setDesc("Target branch for synchronization.")
		.addText((text) =>
			text
				.setPlaceholder("'main'")
				.setValue(plugin.settings.branch)
				.onChange(async (val) => {
					plugin.settings.branch = val.trim();
					await plugin.saveSettings();
				}),
		);

	new Setting(itemEl)
		.setName("Remote name")
		.setDesc("Name of the remote tracker (usually 'origin').")
		.addText((text) =>
			text
				.setPlaceholder("'origin'")
				.setValue(plugin.settings.remoteName)
				.onChange(async (val) => {
					plugin.settings.remoteName = val.trim();
					await plugin.saveSettings();
				}),
		);

	new Setting(itemEl)
		.setName("Local path")
		.setDesc(
			"Folder inside the vault where the encrypted Git repository will be located.",
		)
		.addText((text) =>
			text
				.setPlaceholder("Example: .git-encrypted")
				.setValue(plugin.settings.localPath)
				.onChange(async (val) => {
					plugin.settings.localPath = val.trim();
					await plugin.saveSettings();
				}),
		);
}
