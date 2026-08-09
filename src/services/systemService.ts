import type GitEncryptPlugin from "../main";
import { getModule, isMobile } from "./nodeContext";
import { getCryptoGitService } from "./cryptoGitService";

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
	 * @returns The command output on success, `""` if the command produced no output (success or failure),
	 *          or `null` if the platform does not support execution (mobile / missing module).
	 */
	async execDesktopCommand(
		cmd: string,
		timeout: number = 30_000,
	): Promise<string | null> {
		if (isMobile) return null;

		const childProcess = getModule<ChildProcessModule>("child_process");
		if (!childProcess) return null;

		return new Promise<string | null>((resolve, reject) => {
			const timer = window.setTimeout(() => {
				const error = new Error(
					`GitEncrypt: execDesktopCommand timed out after ${timeout}ms: ${cmd}`,
				);
				reject(error);
			}, timeout);

			childProcess.exec(cmd, (err: unknown, stdout: string) => {
				window.clearTimeout(timer);
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
		if (isMobile) return null;

		const path = getModule<PathModule>("path");
		const fs = getModule<FsModule>("fs")?.promises;
		const os = getModule<OsModule>("os");

		if (!path || !fs || !os) return null;

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
	 * @returns A promise containing name/email, or `null` for each field when
	 *          the platform is unreachable (mobile) or Git has no config set.
	 */
	async getGitGlobalUser(): Promise<{
		name: string | null;
		email: string | null;
	}> {
		if (isMobile) return { name: null, email: null };

		try {
			const nameOut =
				(await this.execDesktopCommand(
					"git config --global user.name",
				)) ?? "";
			const emailOut =
				(await this.execDesktopCommand(
					"git config --global user.email",
				)) ?? "";

			return {
				name: nameOut.trim() || null,
				email: emailOut.trim() || null,
			};
		} catch (error) {
			console.warn("Failed to get global git user:", error);
			return { name: null, email: null };
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
		if (isMobile || !filePath) return false;

		const fs = getModule<FsModule>("fs")?.promises;
		if (!fs) return false;

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
		if (isMobile || !filePath) return null;

		const fs = getModule<FsModule>("fs")?.promises;
		const crypto = getModule<CryptoModule>("crypto");
		const path = getModule<PathModule>("path");

		if (!fs || !crypto || !path) return null;

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
			// No Notice — callers display user-facing errors.
			return null;
		}
	}

	/**
	 * Encrypts the master key hex using Electron safeStorage.
	 * Does NOT persist to plugin state — callers update settings themselves.
	 * Only executes on desktop platforms.
	 *
	 * @param keyHex - The 64-character raw hex representation of the key.
	 * @returns A typed result: encrypted key string on success, error description on failure.
	 */
	async saveKeyToKeychain(keyHex: string): Promise<SaveKeyToKeychainResult> {
		if (isMobile) {
			return { success: false, error: "Keychain unavailable on mobile" };
		}

		const electron = getModule<ElectronModule>("electron");
		if (!electron) {
			return { success: false, error: "Electron module unavailable" };
		}
		const safeStorage = electron?.safeStorage;

		if (!safeStorage?.isEncryptionAvailable()) {
			return {
				success: false,
				error: "Keychain encryption not available",
			};
		}

		try {
			const encryptedBuffer = safeStorage.encryptString(keyHex);
			const binaryString = Array.from(encryptedBuffer)
				.map((b) => String.fromCodePoint(b))
				.join("");
			const encryptedKey = btoa(binaryString);

			return { success: true, encryptedKey };
		} catch (error) {
			console.error("GitEncrypt: Failed to save key to keychain", error);
			const message =
				error instanceof Error ? error.message : String(error);
			return { success: false, error: message };
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
		if (isMobile || !this.plugin.settings.encryptedMasterKey) {
			return {
				success: false,
				error: "unknown",
				details: "No encrypted key available",
			};
		}

		const electron = getModule<ElectronModule>("electron");
		if (!electron) {
			return {
				success: false,
				error: "unknown",
				details: "Electron module unavailable",
			};
		}
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

	/**
	 * Runs `git status --short` and returns the raw output.
	 * Each line follows the format `<XY> <path>` where XY is the status codes.
	 * Only executes on desktop platforms.
	 */
	async gitStatus(): Promise<string | null> {
		return this.execDesktopCommand("git status --short");
	}

	/**
	 * Stages all changes and commits with a timestamped message.
	 * Uses `git add -A` then `git commit -m`.
	 * Only executes on desktop platforms.
	 */
	async gitCommit(): Promise<string | null> {
		const ts = new Date().toISOString().replace(/[:.]/g, "-");
		await this.execDesktopCommand("git add -A");
		return this.execDesktopCommand(
			`git commit -m "Git Encrypt auto-commit ${ts}"`,
		);
	}

	/**
	 * Merges the specified branch into the current branch.
	 * Only executes on desktop platforms.
	 *
	 * @param branch - Branch to merge (e.g., "main").
	 */
	async gitMerge(branch: string): Promise<string | null> {
		return this.execDesktopCommand(`git merge ${branch}`);
	}

	/**
	 * Pulls from the configured remote and branch.
	 * Only executes on desktop platforms.
	 */
	async gitPull(): Promise<string | null> {
		const remote = this.plugin.settings.remoteName || "origin";
		const branch = this.plugin.settings.branch || "main";
		return this.execDesktopCommand(`git pull ${remote} ${branch}`);
	}

	/**
	 * Pushes to the configured remote and branch.
	 * Only executes on desktop platforms.
	 */
	async gitPush(): Promise<string | null> {
		const remote = this.plugin.settings.remoteName || "origin";
		const branch = this.plugin.settings.branch || "main";
		return this.execDesktopCommand(`git push ${remote} ${branch}`);
	}

	/**
	 * Pulls from remote via git-remote-crypto (encrypted pull + decrypt).
	 * Returns the crypto result message, or falls back to plain git pull.
	 * Only executes on desktop platforms.
	 */
	async cryptoPull(): Promise<string | null> {
		if (isMobile) {
			return this.execDesktopCommand(
				`git pull ${this.plugin.settings.remoteName || "origin"} ${this.plugin.settings.branch || "main"}`,
			);
		}

		const cryptoService = getCryptoGitService();
		const result = await cryptoService.cryptoPull(this.plugin);

		if (result.success) {
			return result.message;
		}

		// Fallback: try plain git pull.
		try {
			return await this.execDesktopCommand(
				`git pull ${this.plugin.settings.remoteName || "origin"} ${this.plugin.settings.branch || "main"}`,
			);
		} catch {
			return null;
		}
	}

	/**
	 * Pushes to remote via git-remote-crypto (encrypt + push).
	 * Returns the crypto result message, or falls back to plain git push.
	 * Only executes on desktop platforms.
	 */
	async cryptoPush(): Promise<string | null> {
		if (isMobile) {
			return this.execDesktopCommand(
				`git push ${this.plugin.settings.remoteName || "origin"} ${this.plugin.settings.branch || "main"}`,
			);
		}

		const cryptoService = getCryptoGitService();
		const result = await cryptoService.cryptoPush(this.plugin);

		if (result.success) {
			return result.message;
		}

		// Fallback: try plain git push.
		try {
			return await this.execDesktopCommand(
				`git push ${this.plugin.settings.remoteName || "origin"} ${this.plugin.settings.branch || "main"}`,
			);
		} catch {
			return null;
		}
	}

	/**
	 * Stages all changes and commits via git-remote-crypto.
	 * Only executes on desktop platforms.
	 */
	async cryptoCommit(): Promise<string | null> {
		if (isMobile) {
			await this.execDesktopCommand("git add -A");
			const ts = new Date().toISOString().replace(/[:.]/g, "-");
			return this.execDesktopCommand(
				`git commit -m "Git Encrypt auto-commit ${ts}"`,
			);
		}

		const cryptoService = getCryptoGitService();
		const result = await cryptoService.cryptoCommit(this.plugin);

		if (result.success) {
			return result.output || "";
		}

		// Fallback: plain git commit.
		await this.execDesktopCommand("git add -A");
		const ts = new Date().toISOString().replace(/[:.]/g, "-");
		return this.execDesktopCommand(
			`git commit -m "Git Encrypt auto-commit ${ts}"`,
		);
	}

	/**
	 * Gets status of the encrypted repository.
	 * Only executes on desktop platforms.
	 */
	async cryptoStatus(): Promise<string | null> {
		if (isMobile) {
			return this.execDesktopCommand("git status --short");
		}

		const cryptoService = getCryptoGitService();
		const result = await cryptoService.cryptoStatus();

		if (result.success && result.output) {
			return result.output;
		}

		// Fallback: plain git status.
		return this.execDesktopCommand("git status --short");
	}
}

/**
 * Result of encrypting and saving a master key to the system keychain.
 * Returns the encrypted payload on success for the caller to persist.
 */
export type SaveKeyToKeychainResult =
	| { success: true; encryptedKey: string }
	| { success: false; error: string };

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
