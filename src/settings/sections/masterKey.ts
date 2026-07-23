import { App, Notice, Platform, Setting } from "obsidian";
import type GitEncryptPlugin from "../../main";
import { createSettingGroup } from "../ui";

/**
 * Renders the master encryption key configuration section (Zero-Knowledge).
 * On desktop, it facilitates reading/validating keys from external files, entering them manually,
 * or securely offloading them to the operating system's native secure credential storage (Keychain).
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

	// How-it-works callout — explains zero-knowledge model before storage options.
	const calloutEl = itemEl.createDiv({
		cls: "callout callout-info",
		attr: { role: "note" },
	});
	calloutEl.createDiv({ cls: "callout-icon" }).innerHTML =
		'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>';
	calloutEl.createDiv({
		cls: "callout-title",
		text: "How encryption works",
	});
	calloutEl.createDiv({
		cls: "callout-content",
		text: "Your master key encrypts every note before it leaves your device. Neither the Git remote nor the plugin authors can read your data. Choose how you want to store the key below.",
	});

	if (Platform.isMobile) {
		if (plugin.settings.masterKeySource !== "manual") {
			plugin.settings.masterKeySource = "manual";
			await plugin.saveSettings();
		}
	} else {
		new Setting(itemEl)
			.setName("Master key source")
			.setDesc(
				"Choose whether to store the key securely in system keychain, read from a file, or enter it manually.",
			)
			.addDropdown((dropdown) =>
				dropdown
					.addOption(
						"keychain",
						"System Keychain — stored in your OS's encrypted credential vault (macOS Keychain / Windows Credential Manager / Linux Secret Service)",
					)
					.addOption(
						"file",
						"Key File — read from an external file on your computer",
					)
					.addOption(
						"manual",
						"Enter Manually — type or paste the hex key directly",
					)
					.setValue(plugin.settings.masterKeySource)
					.onChange(async (val: "keychain" | "file" | "manual") => {
						plugin.settings.masterKeySource = val;
						await plugin.saveSettings();
						await plugin.refreshSettingsTab();
					}),
			);
	}

	if (!Platform.isMobile && plugin.settings.masterKeySource === "keychain") {
		const keychainSetting = new Setting(itemEl)
			.setName("System credential storage")
			.setDesc(
				"The key will be encrypted via os native security APIs and stored in your vault config.",
			);

		keychainSetting.addButton((btn) =>
			btn
				.setButtonText("Generate & save to keychain")
				.setCta()
				.onClick(async () => {
					const randomBytes = new Uint8Array(32);
					window.crypto.getRandomValues(randomBytes);
					const generatedHex = Array.from(randomBytes)
						.map((b) => b.toString(16).padStart(2, "0"))
						.join("");

					const success =
						await plugin.sys.saveKeyToKeychain(generatedHex);
					if (success) {
						keychainSetting.setDesc(
							"Key successfully generated and encrypted inside system keychain.",
						);
					} else {
						keychainSetting.setDesc(
							"Failed to access system secure storage. Check os permissions.",
						);
					}
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
				const isValid = await plugin.sys.checkMasterKeyFile(
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
					const newKeyHex =
						await plugin.sys.generateAndSaveMasterKeyFile(
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
						const trimmed = val.trim();
						if (trimmed.length > 0 && !/^[0-9a-fA-F]{64}$/.test(trimmed)) {
							new Notice("Master key must be exactly 64 hexadecimal characters.");
							return;
						}
						plugin.settings.masterKeyHex = trimmed;
						await plugin.saveSettings();
					});
				text.inputEl.type = "password";
			});

		keySetting.addButton((btn) =>
			btn.setButtonText("Load key").onClick(async () => {
				const text = await navigator.clipboard.readText();
				const trimmed = text.trim();
				if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
					new Notice("Clipboard does not contain a valid 64-character hex key.");
					return;
				}
				plugin.settings.masterKeyHex = trimmed;
				await plugin.saveSettings();
				await plugin.refreshSettingsTab();
			}),
		);

		keySetting.addButton((btn) =>
			btn.setButtonText("Copy").onClick(async () => {
				if (plugin.settings.masterKeyHex.length !== 64) {
					new Notice("No key to copy — enter or generate one first.");
					return;
				}
				await navigator.clipboard.writeText(plugin.settings.masterKeyHex);
				new Notice("Key copied to clipboard.");
			}),
		);

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

		if (!Platform.isMobile) {
			keySetting.addButton((btn) =>
				btn
					.setButtonText("Move to keychain")
					.setCta()
					.onClick(async () => {
						if (plugin.settings.masterKeyHex.length !== 64) {
							new Notice(
								"Please enter a valid 64-character hex key first.",
							);
							return;
						}
						const success = await plugin.sys.saveKeyToKeychain(
							plugin.settings.masterKeyHex,
						);
						if (success) {
							new Notice(
								"Key successfully moved to system keychain.",
							);
							await plugin.refreshSettingsTab();
						} else {
							new Notice(
								"Failed to save key to keychain. Check console for details.",
							);
						}
					}),
			);
		}
	}
}
