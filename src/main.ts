import { Notice, Plugin } from "obsidian";
import {
	GitEncryptSettingTab,
	GitEncryptSettings,
	DEFAULT_SETTINGS,
} from "./settings";
import { SystemService } from "./services/systemService";

/**
 * Main entry point for the Git Encrypt Obsidian plugin.
 * Coordinates the plugin lifecycle, setting persistence, view orchestration,
 * and initializes platform-specific core system services.
 */
export default class GitEncryptPlugin extends Plugin {
	/** Active plugin configuration state */
	settings: GitEncryptSettings;

	/** Managed UI instance for the Obsidian settings tab view */
	settingsTab: GitEncryptSettingTab;

	/** Encapsulated business logic service for native OS/NodeJS and cryptographic operations */
	sys: SystemService;

	/**
	 * Executes on plugin activation.
	 * Boots internal configurations, binds decoupled services, and mounts the application settings UI.
	 *
	 * @returns A promise that resolves when full initialization is complete.
	 */
	async onload(): Promise<void> {
		await this.loadSettings();
		this.sys = new SystemService(this);
		this.settingsTab = new GitEncryptSettingTab(this.app, this);
		this.addSettingTab(this.settingsTab);
	}

	/**
	 * Loads saved metadata configuration from Obsidian's transactional local storage backend.
	 * Merges state smoothly into standard configuration defaults for fallback safety.
	 *
	 * @returns A promise that resolves when configuration state is populated.
	 */
	async loadSettings(): Promise<void> {
		const loadedData =
			(await this.loadData()) as Partial<GitEncryptSettings> | null;

		this.settings = { ...DEFAULT_SETTINGS, ...loadedData };

		if (this.settings.masterKeySource === "keychain") {
			const result = await this.sys.loadKeyFromKeychain();
			if (result.success) {
				this.settings.masterKeyHex = result.key;
			} else {
				this.settings.masterKeySource = "manual";
				this.settings.masterKeyHex = "";
				await this.saveSettings();

				switch (result.error) {
					case "locked":
						new Notice(
							"Git Encrypt: System keychain is locked. " +
								"Unlock your OS login/session and restart Obsidian, " +
								"or switch to manual key entry in settings.",
						);
						break;
					case "corrupted":
						new Notice(
							"Git Encrypt: The keychain data is corrupted or was encrypted with a different key. " +
								"Switching to manual entry — you'll need to re-save your master key to the keychain " +
								"after entering it manually.",
							10_000,
						);
						break;
					default:
						new Notice(
							"Git Encrypt: Unable to read the keychain. " +
								"Switching to manual key entry.",
						);
						break;
				}
			}
		}
	}

	/**
	 * Persists the current configuration schema snapshot into disk-backed storage (`data.json`).
	 *
	 * @returns A promise that resolves once serialization and write pipeline operations succeed.
	 */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Forces an instantaneous redrawing of the plugin configuration workspace panel if it is actively visible.
	 *
	 * @returns A promise that resolves after the view finishes rendering changes.
	 */
	async refreshSettingsTab(): Promise<void> {
		if (this.settingsTab) {
			this.settingsTab.display();
		}
	}
}
