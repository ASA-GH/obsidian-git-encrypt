import { App, Notice, Setting } from "obsidian";
import type GitEncryptPlugin from "../../main";
import { createSettingGroup, renderCallout, renderWarningCallout } from "../ui";
import { isValidHexKey } from "../validators";
import { isMobilePlatform } from "../platform";

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
	renderCallout(
		itemEl,
		"How encryption works",
		"Your master key encrypts every note before it leaves your device. Neither the Git remote nor the plugin authors can read your data. Choose how you want to store the key below.",
	);

	// Key preservation warning — without the key, files are permanently unreadable.
	renderWarningCallout(
		itemEl,
		"Save your key before syncing",
		"Without the master key, your local vault files become permanently unreadable. Make sure your key is saved — either in your OS keychain, copied to a secure location, or written down — before performing your first push or pull.",
	);

	if (isMobilePlatform) {
		if (plugin.settings.masterKeySource !== "manual") {
			plugin.settings.masterKeySource = "manual";
			await plugin.saveSettings();
		}
		renderManualKeyEntry(itemEl, plugin);
	} else {
		renderDesktopKeyOptions(itemEl, plugin);
		renderManualKeyEntry(itemEl, plugin, app);
	}
}

/**
 * Renders desktop-only key source options: master key source dropdown,
 * keychain generation, and file-based key management.
 *
 * @param itemEl - The parent HTML element for this section.
 * @param plugin - The main plugin instance containing settings and helper methods.
 */
function renderDesktopKeyOptions(
	itemEl: HTMLElement,
	plugin: GitEncryptPlugin,
): void {
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

	if (plugin.settings.masterKeySource === "keychain") {
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

					const result =
						await plugin.sys.saveKeyToKeychain(generatedHex);
					if (result.success) {
						plugin.settings.encryptedMasterKey = result.encryptedKey;
						plugin.settings.masterKeySource = "keychain";
						plugin.settings.masterKeyHex = "";
						await plugin.saveSettings();
						keychainSetting.setDesc(
							"Key successfully generated and encrypted inside system keychain.",
						);
					} else {
						keychainSetting.setDesc(
							`Failed to access system secure storage: ${result.error}`,
						);
					}
				}),
		);
	}

	if (plugin.settings.masterKeySource === "file") {
		new Setting(itemEl)
			.setName("Key file path")
			.setDesc(
				"Path to the external file containing a 32-byte hex-encoded key.",
			)
			.addText((text) =>
				text
					.setPlaceholder("git-encrypt.key")
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
}

/**
 * Renders the manual master key entry UI with generate, copy, and load-from-clipboard actions.
 * On desktop, also includes the "Move to keychain" migration button.
 *
 * @param itemEl - The parent HTML element for this section.
 * @param plugin - The main plugin instance containing settings and helper methods.
 * @param app - The Obsidian application instance (desktop-only for placeholder text and keychain migration).
 */
function renderManualKeyEntry(
	itemEl: HTMLElement,
	plugin: GitEncryptPlugin,
	app?: App,
): void {
	const keySetting = new Setting(itemEl)
		.setName("Master key (hex)")
		.setDesc("64 hex characters representing a 32-byte encryption key.")
		.addText((text) => {
			text.setPlaceholder(
				app ? "Enter a 64-character hex string..." : "Paste your 64-char hex key here",
			)
				.setValue(plugin.settings.masterKeyHex)
				.onChange(async (val) => {
					const trimmed = val.trim();
					if (trimmed.length > 0 && !isValidHexKey(trimmed)) {
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
			if (!isValidHexKey(trimmed)) {
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

	if (app) {
		keySetting.addButton((btn) =>
			btn
				.setButtonText("Move to keychain")
				.setCta()
				.onClick(async () => {
					if (plugin.settings.masterKeyHex.length !== 64) {
						new Notice("Please enter a valid 64-character hex key first.");
						return;
					}
					const result = await plugin.sys.saveKeyToKeychain(
						plugin.settings.masterKeyHex,
					);
					if (result.success) {
						plugin.settings.encryptedMasterKey = result.encryptedKey;
						plugin.settings.masterKeySource = "keychain";
						plugin.settings.masterKeyHex = "";
						await plugin.saveSettings();
						new Notice("Key successfully moved to system keychain.");
						await plugin.refreshSettingsTab();
					} else {
						new Notice("Failed to save key to keychain: " + result.error);
					}
				}),
		);
	}
}
