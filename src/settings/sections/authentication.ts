import { Setting, Platform } from "obsidian";
import type GitEncryptPlugin from "../../main";
import { createSettingGroup } from "../ui";

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
	const itemEl = createSettingGroup(
		containerEl,
		`Authentication (${plugin.settings.transportType === "https" ? "HTTPS" : "SSH"})`,
	);

	if (plugin.settings.transportType === "https") {
		new Setting(itemEl)
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

		new Setting(itemEl)
			.setName("Personal access token")
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
				text.inputEl.type = "password";
			});
		} else {

	if (!Platform.isMobile) {
		new Setting(itemEl)
			.setName("SSH key source")
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
						await plugin.refreshSettingsTab();
					}),
			);
	} else if (plugin.settings.sshKeySource !== "manual") {
		plugin.settings.sshKeySource = "manual";
		await plugin.saveSettings();
	}

	if (!Platform.isMobile && plugin.settings.sshKeySource === "git") {
		const gitPathSetting = new Setting(itemEl)
			.setName("Key path (from Git)")
			.setDesc(
				"Automatically discovered path from your global Git configuration.",
			);

		const pathDesc = document.createSpan();
		pathDesc.setAttr("style", "font-family: monospace; font-size: 0.9em;");
		gitPathSetting.descEl.appendChild(pathDesc);

		const detectedPath = await plugin.sys.getGitSshKeyPath();
		pathDesc.innerText =
			detectedPath ||
			"Failed to detect key path. Please select manual input or verify Git configuration.";

		gitPathSetting.addButton((btn) =>
			btn.setButtonText("Check").onClick(async () => {
				const newPath = await plugin.sys.getGitSshKeyPath();
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
		new Setting(itemEl)
			.setName("Private key content")
			.setDesc(
				"Paste the full contents of your private SSH key (including header and footer boundaries).",
			)
			.addTextArea((text) =>
				text
					.setPlaceholder("Begin open SSH private key")
					.setValue(plugin.settings.sshPrivateKeyText)
					.onChange(async (val) => {
						plugin.settings.sshPrivateKeyText = val.trim();
						await plugin.saveSettings();
					}),
			);
	}

	if (!Platform.isMobile && plugin.settings.sshKeySource === "manual") {
		new Setting(itemEl)
			.setName("Private key file path (optional)")
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

	new Setting(itemEl)
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
			text.inputEl.type = "password";
		});

	new Setting(itemEl)
		.setName("SSH port")
		.setDesc("Network connection port for SSH. Default is 22.")
		.addText((text) =>
			text
				.setValue(String(plugin.settings.sshPort))
				.onChange(async (val) => {
					const port = Number.parseInt(val.trim(), 10);
					if (!Number.isNaN(port)) {
						plugin.settings.sshPort = port;
						await plugin.saveSettings();
					}
				}),
		);
	}
}
