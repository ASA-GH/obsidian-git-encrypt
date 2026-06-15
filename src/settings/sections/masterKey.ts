import { App, Platform, Setting } from "obsidian";
import type GitEncryptPlugin from "../../main";
import { createSettingGroup } from "../ui";

/**
 * Renders the master encryption key configuration section (Zero-Knowledge).
 * On desktop, it facilitates reading, validating, or generating keys stored inside external files.
 * On mobile, it locks operation to manual hex configuration with secure web-crypto generation.
 *
 * @param containerEl - The parent HTML element where the section will be rendered.
 * @param plugin - The main plugin instance containing settings and helper methods.
 * @param app - The global Obsidian application instance used to access vault configuration.
 */
export async function renderMasterKeySection(
	containerEl: HTMLElement,
	plugin: GitEncryptPlugin,
	app: App,
): Promise<void> {
	const itemEl = createSettingGroup(containerEl, "Encryption master key");

	if (Platform.isMobile) {
		if (plugin.settings.masterKeySource !== "manual") {
			plugin.settings.masterKeySource = "manual";
			await plugin.saveSettings();
		}
	} else {
		new Setting(itemEl)
			.setName("Master key source")
			.setDesc(
				"Choose whether to read the key from an external file or enter it manually.",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption("file", "Read from file")
					.addOption("manual", "Enter manually")
					.setValue(plugin.settings.masterKeySource)
					.onChange(async (val: "file" | "manual") => {
						plugin.settings.masterKeySource = val;
						await plugin.saveSettings();
						await plugin.refreshSettingsTab();
					}),
			);
	}

	if (!Platform.isMobile && plugin.settings.masterKeySource === "file") {
		new Setting(itemEl)
			.setName("Key file path")
			.setDesc(
				"Path to the external file containing a 32-byte hex-encoded key.",
			)
			.addText((text) =>
				text
					.setPlaceholder(`${app.vault.configDir}/git-encrypt.key`)
					.setValue(plugin.settings.masterKeyFilePath)
					.onChange(async (val) => {
						plugin.settings.masterKeyFilePath = val.trim();
						await plugin.saveSettings();
					}),
			);

		const fileCheckSetting = new Setting(itemEl);

		fileCheckSetting.addButton((btn) =>
			btn.setButtonText("Validate file").onClick(async () => {
				const isValid = await plugin.checkMasterKeyFile(
					plugin.settings.masterKeyFilePath,
				);
				fileCheckSetting.setDesc(
					isValid
						? "File exists and contains a valid 32-byte key."
						: "File not found or key format is invalid.",
				);
			}),
		);

		fileCheckSetting.addButton((btn) =>
			btn
				.setButtonText("Generate new key file")
				.setWarning()
				.onClick(async () => {
					const newKeyHex = await plugin.generateAndSaveMasterKeyFile(
						plugin.settings.masterKeyFilePath,
					);
					if (newKeyHex) {
						plugin.settings.masterKeyHex = newKeyHex;
						await plugin.saveSettings();
						fileCheckSetting.setDesc(
							`Key generated and saved to ${plugin.settings.masterKeyFilePath}`,
						);
						await plugin.refreshSettingsTab();
					} else {
						fileCheckSetting.setDesc(
							"Failed to create file. Please verify write permissions.",
						);
					}
				}),
		);
	}

	if (Platform.isMobile || plugin.settings.masterKeySource === "manual") {
		const keySetting = new Setting(itemEl)
			.setName("Master key (hex)")
			.setDesc("64 hex characters representing a 32-byte encryption key.")
			.addText((text) => {
				text.setPlaceholder("Enter a 64-character hex string...")
					.setValue(plugin.settings.masterKeyHex)
					.onChange(async (val) => {
						plugin.settings.masterKeyHex = val.trim();
						await plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});

		keySetting.addButton((btn) =>
			btn.setButtonText("Generate key").onClick(async () => {
				const randomBytes = new Uint8Array(32);
				window.crypto.getRandomValues(randomBytes);

				plugin.settings.masterKeyHex = Array.from(randomBytes)
					.map((b) => b.toString(16).padStart(2, "0"))
					.join("");
				await plugin.saveSettings();
				await plugin.refreshSettingsTab();
			}),
		);
	}
}
