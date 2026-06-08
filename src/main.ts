import { Notice, Plugin, Platform } from "obsidian";
import {
	GitEncryptSettingTab,
	GitEncryptSettings,
	DEFAULT_SETTINGS,
} from "./settings";

/**
 * Interface definition describing the NodeJS environment available via Electron on desktop platforms.
 * Explicitly typed to satisfy strict ESLint and TypeScript compilation rules.
 */
interface NodeElectronContext {
	require: (moduleName: string) => {
		exec: (cmd: string, cb: (err: unknown, stdout: string) => void) => void;
		promises: {
			access: (path: string) => Promise<void>;
			readFile: (path: string, encoding: string) => Promise<string>;
			mkdir: (
				path: string,
				options: { recursive: boolean },
			) => Promise<void>;
			writeFile: (
				path: string,
				data: string,
				options: { mode: number },
			) => Promise<void>;
		};
		resolve: (...paths: string[]) => string;
		join: (...paths: string[]) => string;
		dirname: (path: string) => string;
		homedir: () => string;
		randomBytes: (size: number) => { toString: (format: string) => string };
	};
}

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
		const loadedData =
			(await this.loadData()) as Partial<GitEncryptSettings> | null;
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
			this.settingsTab.display();
		}
	}

	/**
	 * Executes a shell command on desktop platforms using the dynamic NodeJS context.
	 * Safely swallows errors and returns stdout, or an empty string on failure.
	 */
	private async execDesktopCommand(cmd: string): Promise<string> {
		if (Platform.isMobile) return "";

		try {
			const context = window as unknown as NodeElectronContext;
			if (typeof context.require !== "function") return "";

			const childProcess = context.require("child_process");

			return await new Promise<string>((resolve) => {
				childProcess.exec(cmd, (_err, stdout) => {
					resolve(stdout || "");
				});
			});
		} catch {
			return "";
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
			const context = window as unknown as NodeElectronContext;
			if (typeof context.require !== "function") return null;

			const path = context.require("path");
			const fs = context.require("fs").promises;
			const os = context.require("os");

			const sshCommand = await this.execDesktopCommand(
				"git config --global core.sshCommand",
			);

			if (sshCommand) {
				const sshKeyRegex = /-i\s+(\S+)/;
				const match = sshKeyRegex.exec(sshCommand);
				if (match?.[1]) return path.resolve(match[1].trim());
			}

			const homedir = os.homedir();
			const defaultPaths = [
				path.join(homedir, ".ssh", "id_rsa"),
				path.join(homedir, ".ssh", "id_ed25519"),
				path.join(homedir, ".ssh", "id_ecdsa"),
			];

			for (const p of defaultPaths) {
				try {
					await fs.access(p);
					return p;
				} catch {
					/* empty */
				}
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
			const nameOut = await this.execDesktopCommand(
				"git config --global user.name",
			);
			const emailOut = await this.execDesktopCommand(
				"git config --global user.email",
			);

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
			const context = window as unknown as NodeElectronContext;
			if (typeof context.require !== "function") return false;

			const fs = context.require("fs").promises;

			try {
				await fs.access(filePath);
			} catch {
				return false;
			}

			const content = await fs.readFile(filePath, "utf8");
			return /^[0-9a-fA-F]{64}$/.test(content.trim());
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
		if (Platform.isMobile || !filePath) return null;

		try {
			const context = window as unknown as NodeElectronContext;
			if (typeof context.require !== "function") return null;

			const fs = context.require("fs").promises;
			const crypto = context.require("crypto");
			const path = context.require("path");

			const randomBytes = crypto.randomBytes(32);
			const hex = randomBytes.toString("hex");
			const dir = path.dirname(filePath);

			try {
				await fs.access(dir);
			} catch {
				await fs.mkdir(dir, { recursive: true });
			}

			await fs.writeFile(filePath, hex, { mode: 0o600 });
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
