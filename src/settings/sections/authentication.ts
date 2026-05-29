import { Setting, Platform } from "obsidian";
import type GitEncryptPlugin from "../../main";

/**
 * Renders the authentication settings section.
 * Automatically adapts the view based on the chosen protocol (HTTPS or SSH).
 * Enforces mobile constraints by hiding native file systems and Git operations,
 * allowing only manual text input.
 *
 * @param containerEl - The parent HTML element where the section will be rendered.
 * @param plugin - The main plugin instance containing settings and helper methods.
 */
export async function renderAuthenticationSection(
	containerEl: HTMLElement,
	plugin: GitEncryptPlugin,
): Promise<void> {
	if (plugin.settings.transportType === "https") {
		containerEl.createEl("h3", { text: "Authentication (HTTPS)" });

		new Setting(containerEl)
			.setName("Username")
			.setDesc("Your Git hosting provider username.")
			.addText((text) =>
				text
					.setValue(plugin.settings.httpUsername)
					.onChange(async (val) => {
						plugin.settings.httpUsername = val.trim();
						await plugin.saveSettings();
					}),
			);

		new Setting(containerEl)
			.setName("Personal Access Token (PAT)")
			.setDesc(
				"Token used for authentication (standard passwords are not supported).",
			)
			.addText((text) => {
				text.setValue(plugin.settings.httpToken).onChange(
					async (val) => {
						plugin.settings.httpToken = val.trim();
						await plugin.saveSettings();
					},
				);
				(text.inputEl as HTMLInputElement).type = "password";
			});
		return;
	}

	containerEl.createEl("h3", { text: "Authentication (SSH)" });

	if (!Platform.isMobile) {
		new Setting(containerEl)
			.setName("SSH Key Source")
			.setDesc(
				"Choose whether to automatically discover the key from Git or provide it manually.",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("git", "Use key from Git")
					.addOption("manual", "Enter key manually")
					.setValue(plugin.settings.sshKeySource)
					.onChange(async (val: "git" | "manual") => {
						plugin.settings.sshKeySource = val;
						await plugin.saveSettings();
						plugin.refreshSettingsTab();
					}),
			);
	} else {
		if (plugin.settings.sshKeySource !== "manual") {
			plugin.settings.sshKeySource = "manual";
			await plugin.saveSettings();
		}
	}

	if (!Platform.isMobile && plugin.settings.sshKeySource === "git") {
		const gitPathSetting = new Setting(containerEl)
			.setName("Key Path (from Git)")
			.setDesc(
				"Automatically discovered path from your global Git configuration.",
			);

		const pathDesc = document.createSpan();
		pathDesc.style.fontFamily = "monospace";
		pathDesc.style.fontSize = "0.9em";
		gitPathSetting.descEl.appendChild(pathDesc);

		const detectedPath = await plugin.getGitSshKeyPath();
		pathDesc.innerText =
			detectedPath ||
			"Failed to detect key path. Please select manual input or verify Git configuration.";

		gitPathSetting.addButton((btn) =>
			btn.setButtonText("Check").onClick(async () => {
				const newPath = await plugin.getGitSshKeyPath();
				pathDesc.innerText =
					newPath ||
					"Key not found. Check core.sshCommand or ~/.ssh/config.";
				if (newPath) {
					plugin.settings.sshPrivateKeyPath = newPath;
					await plugin.saveSettings();
				}
			}),
		);
	}

	if (Platform.isMobile || plugin.settings.sshKeySource === "manual") {
		new Setting(containerEl)
			.setName("Private Key Content")
			.setDesc(
				"Paste the full contents of your private SSH key (including header and footer boundaries).",
			)
			.addTextArea((text) =>
				text
					.setPlaceholder("-----BEGIN OPENSSH PRIVATE KEY-----\n...")
					.setValue(plugin.settings.sshPrivateKeyText)
					.onChange(async (val) => {
						plugin.settings.sshPrivateKeyText = val.trim();
						await plugin.saveSettings();
					}),
			);
	}

	if (!Platform.isMobile && plugin.settings.sshKeySource === "manual") {
		new Setting(containerEl)
			.setName("Private Key File Path (Optional)")
			.setDesc(
				"Absolute path to load the key directly from a file. Leave empty to use text box above.",
			)
			.addText((text) =>
				text
					.setPlaceholder("/user/.ssh/id_rsa")
					.setValue(plugin.settings.sshPrivateKeyPath)
					.onChange(async (val) => {
						plugin.settings.sshPrivateKeyPath = val.trim();
						await plugin.saveSettings();
					}),
			);
	}

	new Setting(containerEl)
		.setName("Passphrase")
		.setDesc(
			"Leave empty if your private SSH key does not require a passphrase.",
		)
		.addText((text) => {
			text.setValue(plugin.settings.sshPassphrase || "").onChange(
				async (val) => {
					plugin.settings.sshPassphrase = val;
					await plugin.saveSettings();
				},
			);
			(text.inputEl as HTMLInputElement).type = "password";
		});

	new Setting(containerEl)
		.setName("SSH Port")
		.setDesc("Network connection port for SSH. Default is 22.")
		.addText((text) =>
			text
				.setValue(String(plugin.settings.sshPort))
				.onChange(async (val) => {
					const port = parseInt(val.trim(), 10);
					if (!isNaN(port)) {
						plugin.settings.sshPort = port;
						await plugin.saveSettings();
					}
				}),
		);
}
