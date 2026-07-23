import { Notice, Platform } from "obsidian";
import type GitEncryptPlugin from "../main";
import { getNativeModule } from "./nodeContext";

/**
 * Minimal interface definition for the native Node.js 'child_process' module.
 */
interface ChildProcessModule {
	exec: (cmd: string, cb: (err: unknown, stdout: string) => void) => void;
}

/**
 * Minimal interface definition for the native Node.js 'path' module.
 */
interface PathModule {
	resolve: (...paths: string[]) => string;
	join: (...paths: string[]) => string;
	dirname: (path: string) => string;
}

/**
 * Minimal interface definition for the native Node.js 'fs' module promises.
 */
interface FsModule {
	promises: {
		access: (path: string) => Promise<void>;
		readFile: (path: string, encoding: string) => Promise<string>;
		mkdir: (path: string, options: { recursive: boolean }) => Promise<void>;
		writeFile: (
			path: string,
			data: string,
			options: { mode: number },
		) => Promise<void>;
	};
}

/**
 * Minimal interface definition for the native Node.js 'os' module.
 */
interface OsModule {
	homedir: () => string;
}

/**
 * Minimal interface definition for the native Node.js 'crypto' module.
 */
interface CryptoModule {
	randomBytes: (size: number) => { toString: (format: string) => string };
}

/**
 * Minimal interface definition for the runtime Electron context and safeStorage APIs.
 * Matches current Obsidian desktop environments where 'remote' is removed.
 */
interface ElectronModule {
	safeStorage?: {
		isEncryptionAvailable: () => boolean;
		encryptString: (str: string) => Uint8Array;
		decryptString: (buf: Uint8Array) => string;
	};
}

/**
 * Service orchestrator handling native operating system and Node.js operations.
 * Manages shell execution, environment discovery, filesystem security,
 * and secure desktop credential storage integration (Keychain).
 */
export class SystemService {
	/**
	 * Creates an instance of SystemService.
	 *
	 * @param plugin - The main plugin instance containing state and settings.
	 */
	constructor(private readonly plugin: GitEncryptPlugin) {}

	/**
	 * Executes a shell command on desktop platforms using the dynamic NodeJS context.
	 * Rejects with a descriptive error if the command exceeds the timeout (default 30s).
	 *
	 * @param cmd - The terminal shell command string to evaluate.
	 * @param timeout - Maximum milliseconds before aborting (default 30_000).
	 * @returns A promise resolving to the standard output string, or empty on failure.
	 */
	async execDesktopCommand(
		cmd: string,
		timeout: number = 30_000,
	): Promise<string> {
		if (Platform.isMobile) return "";

		const rawModule = getNativeModule("child_process");
		if (!rawModule) return "";

		const childProcess = rawModule as ChildProcessModule;

		return new Promise<string>((resolve, reject) => {
			const timer = setTimeout(() => {
				const error = new Error(
					`GitEncrypt: execDesktopCommand timed out after ${timeout}ms: ${cmd}`,
				);
				reject(error);
			}, timeout);

			childProcess.exec(cmd, (err: unknown, stdout: string) => {
				clearTimeout(timer);
				if (err) {
					console.error(
						`GitEncrypt: execDesktopCommand failed: ${cmd}`,
						err,
					);
				}
				resolve(stdout || "");
			});
		});
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

		const rawPath = getNativeModule("path");
		const rawFs = getNativeModule("fs");
		const rawOs = getNativeModule("os");

		if (!rawPath || !rawFs || !rawOs) return null;

		const path = rawPath as PathModule;
		const fs = (rawFs as FsModule).promises;
		const os = rawOs as OsModule;

		try {
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

		const rawFs = getNativeModule("fs");
		if (!rawFs) return false;

		const fs = (rawFs as FsModule).promises;

		try {
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

		const rawFs = getNativeModule("fs");
		const rawCrypto = getNativeModule("crypto");
		const rawPath = getNativeModule("path");

		if (!rawFs || !rawCrypto || !rawPath) return null;

		const fs = (rawFs as FsModule).promises;
		const crypto = rawCrypto as CryptoModule;
		const path = rawPath as PathModule;

		try {
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

	/**
	 * Encrypts and saves the master key hex to the system keychain using Electron safeStorage.
	 * Automatically zero-outs plain-text values from standard memory scopes.
	 * Only executes on desktop platforms.
	 *
	 * @param keyHex - The 64-character raw hex representation of the key.
	 * @returns A promise resolving to true if saved successfully, false otherwise.
	 */
	async saveKeyToKeychain(keyHex: string): Promise<boolean> {
		if (Platform.isMobile) return false;

		const rawElectron = getNativeModule("electron");
		if (!rawElectron) return false;

		const electron = rawElectron as ElectronModule;
		const safeStorage = electron?.safeStorage;

		if (!safeStorage?.isEncryptionAvailable()) {
			return false;
		}

		try {
			const encryptedBuffer = safeStorage.encryptString(keyHex);
			const binaryString = Array.from(encryptedBuffer)
				.map((b) => String.fromCodePoint(b))
				.join("");

			this.plugin.settings.encryptedMasterKey = btoa(binaryString);
			this.plugin.settings.masterKeySource = "keychain";

			await this.plugin.saveSettings();

			this.plugin.settings.masterKeyHex = "";

			return true;
		} catch (error) {
			console.error("GitEncrypt: Failed to save key to keychain", error);
			return false;
		}
	}

/**
	 * Decrypts and resolves the master key hex string from the System Keychain using Electron safeStorage.
	 * Only executes on desktop platforms.
	 *
	 * @returns A promise resolving to a `KeychainLoadResult` discriminated union that distinguishes
	 *          between `locked`, `corrupted`, and `unknown` failure modes.
	 */
	async loadKeyFromKeychain(): Promise<KeychainLoadResult> {
		if (Platform.isMobile || !this.plugin.settings.encryptedMasterKey) {
			return {
				success: false,
				error: "unknown",
				details: "No encrypted key available",
			};
		}

		const rawElectron = getNativeModule("electron");
		if (!rawElectron) {
			return {
				success: false,
				error: "unknown",
				details: "Electron module unavailable",
			};
		}

		const electron = rawElectron as ElectronModule;
		const safeStorage = electron?.safeStorage;

		if (!safeStorage?.isEncryptionAvailable()) {
			return {
				success: false,
				error: "unknown",
				details: "Keychain encryption not available",
			};
		}

		try {
			const binaryString = atob(this.plugin.settings.encryptedMasterKey);
			const uint8Array = new Uint8Array(
				binaryString.split("").map((char) => char.codePointAt(0) ?? 0),
			);

			const key = safeStorage.decryptString(uint8Array);
			return { success: true, key };
		} catch (error) {
			return classifyKeychainError(error);
		}
	}
}

/**
 * Result of attempting to load a master key from the system keychain.
 * Discriminates between recoverable (locked) and terminal (corrupted) failures.
 */
export type KeychainLoadResult =
	| { success: true; key: string }
	| { success: false; error: "locked"; details: string }
	| { success: false; error: "corrupted"; details: string }
	| { success: false; error: "unknown"; details: string };

/**
 * Classifies an Electron safeStorage decryption error into a human-readable
 * and machine-distinguishable category.
 *
 * - `"locked"` — the OS keychain is locked; the user should unlock it and try again.
 * - `"corrupted"` — the stored payload cannot be decrypted (mismatched encrypt/decrypt
 *   keys, data corruption, or format mismatch).
 * - `"unknown"` — anything else (permission denied, missing entitlements, etc.).
 */
function classifyKeychainError(error: unknown): KeychainLoadResult {
	const msg = error instanceof Error ? error.message : String(error);
	const lower = msg.toLowerCase();

	if (
		lower.includes("lock") ||
		lower.includes("unlock") ||
		lower.includes("locked") ||
		lower.includes("auth")
	) {
		console.warn(
			"GitEncrypt: System keychain is locked; unlock it and retry.",
		);
		return { success: false, error: "locked", details: msg };
	}

	if (
		lower.includes("decrypt") ||
		lower.includes("corrupt") ||
		lower.includes("invalid") ||
		lower.includes("malformed") ||
		lower.includes("mismatch")
	) {
		console.warn(
			"GitEncrypt: Keychain payload appears corrupted or is encrypted with a different key. " +
				"The user will need to re-save their key to the keychain.",
		);
		return { success: false, error: "corrupted", details: msg };
	}

	console.error("GitEncrypt: Unexpected keychain error", error);
	return { success: false, error: "unknown", details: msg };
}
