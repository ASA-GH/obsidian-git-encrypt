import { Setting, Notice } from "obsidian";
import type GitEncryptPlugin from "../../main";
import { createSettingGroup } from "../ui";
import { isValidEmail } from "../validators";
import { isMobilePlatform } from "../platform";

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
	const itemEl = createSettingGroup(containerEl, "Commit author");

	if (isMobilePlatform) {
		if (plugin.settings.authorSource !== "manual") {
			plugin.settings.authorSource = "manual";
			await plugin.saveSettings();
		}
	} else {
		new Setting(itemEl)
			.setName("Author data source")
			.setDesc(
				"Load identity details from the global Git config or enter them manually.",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("git", "Use global Git config")
					.addOption("manual", "Enter manually")
					.setValue(plugin.settings.authorSource)
					.onChange(async (val: string) => {
						plugin.settings.authorSource = val as "git" | "manual";
						if (val === "git") {
							const { name, email } =
								await plugin.sys.getGitGlobalUser();
							if (name) plugin.settings.authorName = name;
							if (email) plugin.settings.authorEmail = email;
							await plugin.saveSettings();
						}
						await plugin.refreshSettingsTab();
					}),
			);
	}

	if (isMobilePlatform || plugin.settings.authorSource === "manual") {
		new Setting(itemEl)
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

		new Setting(itemEl)
			.setName("Author email")
			.setDesc(
				"The email address associated with each generated Git commit.",
			)
			.addText((text) =>
				text
					.setValue(plugin.settings.authorEmail)
					.onChange(async (val) => {
						const trimmed = val.trim();
						if (trimmed.length > 0 && !isValidEmail(trimmed)) {
							new Notice("Author email must contain '@' and a domain part.");
							return;
						}
						plugin.settings.authorEmail = trimmed;
						await plugin.saveSettings();
					}),
			);
	} else if (!isMobilePlatform && plugin.settings.authorSource === "git") {
		new Setting(itemEl)
			.setName("Author name (from Git)")
			.setDesc(
				"Read-only identity name pulled from the global Git configuration.",
			)
			.addText((text) => {
				text.setValue(plugin.settings.authorName).setDisabled(true);
			});

		new Setting(itemEl)
			.setName("Author email (from Git)")
			.setDesc(
				"Read-only identity email pulled from the global Git configuration.",
			)
			.addText((text) => {
				text.setValue(plugin.settings.authorEmail).setDisabled(true);
			});

		new Setting(itemEl).addButton((btn) =>
			btn.setButtonText("Refresh from Git").onClick(async () => {
				const { name, email } = await plugin.sys.getGitGlobalUser();
				if (name) plugin.settings.authorName = name;
				if (email) plugin.settings.authorEmail = email;
				await plugin.saveSettings();
				await plugin.refreshSettingsTab();
			}),
		);
	}
}
