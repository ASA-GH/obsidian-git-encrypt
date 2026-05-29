import { Notice, Plugin, Platform } from "obsidian";
import {
	GitEncryptSettingTab,
	GitEncryptSettings,
	DEFAULT_SETTINGS,
} from "./settings";

/**
 * Main plugin class for Git Encrypt.
 * Coordinates plugin lifecycle, settings persistence, and desktop-specific native integrations
 * such as Git environment introspection and external cryptographic key file operations.
 */
export default class GitEncryptPlugin extends Plugin {
	settings: GitEncryptSettings;
	settingsTab: GitEncryptSettingTab;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.settingsTab = new GitEncryptSettingTab(this.app, this);
		this.addSettingTab(this.settingsTab);
	}

	/**
	 * Loads settings from Obsidian's data.json storage.
	 * Falls back to default values for missing configuration entries.
	 */
	async loadSettings(): Promise<void> {
		const loadedData = await this.loadData();
		this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);
	}

	/**
	 * Persists the current plugin settings state into data.json storage.
	 */
	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/**
	 * Forces a redrawing of the settings tab view if it is actively open.
	 */
	async refreshSettingsTab(): Promise<void> {
		if (this.settingsTab) {
			await this.settingsTab.display();
		}
	}

	/**
	 * Attempts to locate the absolute path of the global Git SSH private key.
	 * Inspects `core.sshCommand` first, falling back to testing standard identity file paths.
	 * Only executes on desktop platforms.
	 *
	 * @returns A promise that resolves to the absolute path string, or null if undetected.
	 */
	async getGitSshKeyPath(): Promise<string | null> {
		if (Platform.isMobile) return null;

		try {
			const { exec } = require("child_process");
			const { promisify } = require("util");
			const path = require("path");
			const fs = require("fs");
			const os = require("os");
			const execPromise = promisify(exec);

			const { stdout: sshCommand } = await execPromise(
				"git config --global core.sshCommand",
			).catch(() => ({ stdout: "" }));

			if (sshCommand) {
				const match = sshCommand.match(/-i\s+(\S+)/);
				if (match && match[1]) return path.resolve(match[1].trim());
			}

			const homedir = os.homedir();
			const defaultPaths = [
				path.join(homedir, ".ssh", "id_rsa"),
				path.join(homedir, ".ssh", "id_ed25519"),
				path.join(homedir, ".ssh", "id_ecdsa"),
			];

			for (const p of defaultPaths) {
				if (fs.existsSync(p)) return p;
			}
			return null;
		} catch (error) {
			console.warn("Failed to detect SSH key path from Git:", error);
			return null;
		}
	}

	/**
	 * Retrieves the global Git user configuration signature (name and email).
	 * Only executes on desktop platforms.
	 *
	 * @returns A promise containing the trimmed name and email strings.
	 */
	async getGitGlobalUser(): Promise<{ name: string; email: string }> {
		if (Platform.isMobile) return { name: "", email: "" };

		try {
			const { exec } = require("child_process");
			const { promisify } = require("util");
			const execPromise = promisify(exec);

			const { stdout: nameOut } = await execPromise(
				"git config --global user.name",
			).catch(() => ({ stdout: "" }));

			const { stdout: emailOut } = await execPromise(
				"git config --global user.email",
			).catch(() => ({ stdout: "" }));

			return {
				name: nameOut.trim(),
				email: emailOut.trim(),
			};
		} catch (error) {
			console.warn("Failed to get global git user:", error);
			return { name: "", email: "" };
		}
	}

	/**
	 * Validates whether an external file contains a compliant 64-character hex encryption key.
	 * Only executes on desktop platforms.
	 *
	 * @param filePath - Path to the file being inspected.
	 * @returns True if valid file exists and matches specifications, false otherwise.
	 */
	async checkMasterKeyFile(filePath: string): Promise<boolean> {
		if (Platform.isMobile || !filePath) return false;

		try {
			const fs = require("fs");
			if (!fs.existsSync(filePath)) return false;
			const content = fs.readFileSync(filePath, "utf8").trim();
			return /^[0-9a-fA-F]{64}$/.test(content);
		} catch (error) {
			console.warn("Failed to check master key file:", error);
			return false;
		}
	}

	/**
	 * Generates a cryptographically secure 32-byte master key, encodes it to hex,
	 * and saves it into the designated external file path with restrictive user permissions.
	 * Only executes on desktop platforms.
	 *
	 * @param filePath - Target location where the key file will be stored.
	 * @returns The generated 64-character hex string, or null if an error occurs.
	 */
	async generateAndSaveMasterKeyFile(
		filePath: string,
	): Promise<string | null> {
		if (Platform.isMobile) return null;

		try {
			const fs = require("fs");
			const crypto = require("crypto");
			const path = require("path");

			const randomBytes = crypto.randomBytes(32);
			const hex = randomBytes.toString("hex");
			const dir = path.dirname(filePath);

			if (!fs.existsSync(dir)) {
				fs.mkdirSync(dir, { recursive: true });
			}

			fs.writeFileSync(filePath, hex, { mode: 0o600 });
			return hex;
		} catch (error) {
			console.error("Failed to generate or save master key file:", error);
			const message =
				error instanceof Error ? error.message : String(error);
			new Notice(`Master key storage error: ${message}`);
			return null;
		}
	}
}
