import { Setting, Platform } from "obsidian";
import type GitEncryptPlugin from "../../main";

/**
 * Renders the master encryption key configuration section (Zero-Knowledge).
 * On desktop, it facilitates reading, validating, or generating keys stored inside external files.
 * On mobile, it locks operation to manual hex configuration with secure web-crypto generation.
 *
 * @param containerEl - The parent HTML element where the section will be rendered.
 * @param plugin - The main plugin instance containing settings and helper methods.
 */
export async function renderMasterKeySection(
	containerEl: HTMLElement,
	plugin: GitEncryptPlugin,
): Promise<void> {
	containerEl.createEl("h3", {
		text: "Encryption Master Key (Zero-Knowledge)",
	});

	if (!Platform.isMobile) {
		new Setting(containerEl)
			.setName("Master Key Source")
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
						plugin.refreshSettingsTab();
					}),
			);
	} else {
		if (plugin.settings.masterKeySource !== "manual") {
			plugin.settings.masterKeySource = "manual";
			await plugin.saveSettings();
		}
	}

	if (!Platform.isMobile && plugin.settings.masterKeySource === "file") {
		new Setting(containerEl)
			.setName("Key File Path")
			.setDesc(
				"Path to the external file containing a 32-byte hex-encoded key.",
			)
			.addText((text) =>
				text
					.setPlaceholder(".obsidian/git-encrypt.key")
					.setValue(plugin.settings.masterKeyFilePath)
					.onChange(async (val) => {
						plugin.settings.masterKeyFilePath = val.trim();
						await plugin.saveSettings();
					}),
			);

		const fileCheckSetting = new Setting(containerEl);

		fileCheckSetting.addButton((btn) =>
			btn.setButtonText("Validate File").onClick(async () => {
				const isValid = await plugin.checkMasterKeyFile(
					plugin.settings.masterKeyFilePath,
				);
				if (isValid) {
					fileCheckSetting.setDesc(
						"File exists and contains a valid 32-byte key.",
					);
				} else {
					fileCheckSetting.setDesc(
						"File not found or key format is invalid.",
					);
				}
			}),
		);

		fileCheckSetting.addButton((btn) =>
			btn
				.setButtonText("Generate New Key File")
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
						plugin.refreshSettingsTab();
					} else {
						fileCheckSetting.setDesc(
							"Failed to create file. Please verify write permissions.",
						);
					}
				}),
		);
	}

	if (Platform.isMobile || plugin.settings.masterKeySource === "manual") {
		const keySetting = new Setting(containerEl)
			.setName("Master Key (Hex)")
			.setDesc("64 hex characters representing a 32-byte encryption key.")
			.addText((text) => {
				text.setPlaceholder("a1b2c3...")
					.setValue(plugin.settings.masterKeyHex)
					.onChange(async (val) => {
						plugin.settings.masterKeyHex = val.trim();
						await plugin.saveSettings();
					});
				(text.inputEl as HTMLInputElement).type = "password";
			});

		keySetting.addButton((btn) =>
			btn.setButtonText("Generate Key").onClick(async () => {
				const randomBytes = new Uint8Array(32);
				window.crypto.getRandomValues(randomBytes);
				const hex = Array.from(randomBytes)
					.map((b) => b.toString(16).padStart(2, "0"))
					.join("");
				plugin.settings.masterKeyHex = hex;
				await plugin.saveSettings();
				plugin.refreshSettingsTab();
			}),
		);
	}
}
