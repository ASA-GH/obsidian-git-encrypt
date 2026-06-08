import { Setting, Platform } from "obsidian";
import type GitEncryptPlugin from "../../main";

/**
 * Renders the commit author configuration section.
 * Allows automatic pulling of username and email from global Git configs on desktop,
 * and restricts input to strict manual configuration on mobile platforms.
 *
 * @param containerEl - The parent HTML element where the section will be rendered.
 * @param plugin - The main plugin instance containing settings and helper methods.
 */
export async function renderAuthorSection(
	containerEl: HTMLElement,
	plugin: GitEncryptPlugin,
): Promise<void> {
	containerEl.createEl("h3", { text: "Commit author" });

	if (Platform.isMobile) {
		if (plugin.settings.authorSource !== "manual") {
			plugin.settings.authorSource = "manual";
			await plugin.saveSettings();
		}
	} else {
		new Setting(containerEl)
			.setName("Author data source")
			.setDesc(
				"Load identity details from the global Git config or enter them manually.",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("git", "Use global Git config")
					.addOption("manual", "Enter manually")
					.setValue(plugin.settings.authorSource)
					.onChange(async (val: "git" | "manual") => {
						plugin.settings.authorSource = val;
						if (val === "git") {
							const { name, email } =
								await plugin.getGitGlobalUser();
							if (name) plugin.settings.authorName = name;
							if (email) plugin.settings.authorEmail = email;
							await plugin.saveSettings();
						}
						await plugin.refreshSettingsTab();
					}),
			);
	}

	if (Platform.isMobile || plugin.settings.authorSource === "manual") {
		new Setting(containerEl)
			.setName("Author name")
			.setDesc("The name associated with each generated Git commit.")
			.addText((text) =>
				text
					.setValue(plugin.settings.authorName)
					.onChange(async (val) => {
						plugin.settings.authorName = val.trim();
						await plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Author email")
			.setDesc(
				"The email address associated with each generated Git commit.",
			)
			.addText((text) =>
				text
					.setValue(plugin.settings.authorEmail)
					.onChange(async (val) => {
						plugin.settings.authorEmail = val.trim();
						await plugin.saveSettings();
					}),
			);
	} else if (!Platform.isMobile && plugin.settings.authorSource === "git") {
		new Setting(containerEl)
			.setName("Author name (from Git)")
			.setDesc(
				"Read-only identity name pulled from the global Git configuration.",
			)
			.addText((text) => {
				text.setValue(plugin.settings.authorName).setDisabled(true);
			});

		new Setting(containerEl)
			.setName("Author email (from Git)")
			.setDesc(
				"Read-only identity email pulled from the global Git configuration.",
			)
			.addText((text) => {
				text.setValue(plugin.settings.authorEmail).setDisabled(true);
			});

		new Setting(containerEl).addButton((btn) =>
			btn.setButtonText("Refresh from Git").onClick(async () => {
				const { name, email } = await plugin.getGitGlobalUser();
				if (name) plugin.settings.authorName = name;
				if (email) plugin.settings.authorEmail = email;
				await plugin.saveSettings();
				await plugin.refreshSettingsTab();
			}),
		);
	}
}
