import type { RepoProfile, SshRepoProfile } from "git-remote-crypto";
import type GitEncryptPlugin from "../main";
import { getModule } from "./nodeContext";

/**
 * Minimal manager interface — avoids the generic CryptoGitManager<P>
 * and the need for `any` type arguments.
 */
interface GitManager {
	addProfile(profile: Record<string, unknown>): void;
	init(name: string): Promise<void>;
	pull(name: string): Promise<void>;
	push(name: string, remote?: string): Promise<void>;
	commit(
		name: string,
		message: string,
		author?: { name: string; email: string },
	): Promise<string>;
	add(name: string, filepath: string | string[]): Promise<void>;
}

/**
 * Result of a crypto Git operation.
 */
export type CryptoGitResult =
	| { success: true; output?: string; message: string }
	| { success: false; error: string };

/**
 * Lazy-loaded crypto Git service.
 * Loads git-remote-crypto dynamically (Node.js / Electron only).
 * Caches the CryptoKey and CryptoGitManager to avoid re-initialization.
 *
 * On mobile: all methods return failure — the library requires Node fs/http.
 */
class CryptoGitService {
	/** Lazy-initialized CryptoGitManager. */
	private manager: GitManager | null = null;

	/** Lazy-initialized master CryptoKey. */
	private masterKey: unknown = null;

	/** Whether masterKey has been loaded. */
	private keyLoaded = false;

	/** Profile name used to identify this repo in the manager. */
	private readonly profileName = "git-encrypt-vault";

	/**
	 * Convert a 64-char hex key string to a SecureBinaryData (Uint8Array).
	 * @param hexKey - 64-character hexadecimal string (32 bytes).
	 * @returns Uint8Array of raw key bytes, or null if invalid.
	 */
	private hexToBytes(hexKey: string): Uint8Array | null {
		const trimmed = hexKey.trim();
		if (!/^[0-9a-fA-F]{64}$/.test(trimmed)) {
			return null;
		}
		const bytes = new Uint8Array(32);
		for (let i = 0; i < 32; i++) {
			bytes[i] = Number.parseInt(trimmed.slice(i * 2, i * 2 + 2), 16);
		}
		return bytes;
	}

	/**
	 * Load the master key (hex string) into a CryptoKey via git-remote-crypto.
	 * @param keyHex - 64-char hex master key.
	 * @returns true if loaded, false otherwise.
	 */
	async loadKey(keyHex: string): Promise<boolean> {
		if (this.keyLoaded) return true;

		const bytes = this.hexToBytes(keyHex);
		if (!bytes) return false;

		const gitCrypto = getModule<unknown>("git-remote-crypto");
		if (!gitCrypto) return false;

		try {
			this.masterKey = await (
				gitCrypto as { importMasterKey: (bytes: Uint8Array) => Promise<unknown> }
			).importMasterKey(bytes);
			this.keyLoaded = true;
			return true;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			console.error(
				`GitEncrypt: Failed to load crypto master key: ${message}`,
			);
			return false;
		}
	}

	/**
	 * Lazy-initialize the CryptoGitManager with the configured profile.
	 * Uses zero-config API — no manual fs/http injection.
	 * The manager resolves httpClient and fs per-profile automatically.
	 * @param plugin - The plugin instance with settings.
	 * @returns The manager instance, or null if initialization failed.
	 */
	private async getManager(
		plugin: GitEncryptPlugin,
	): Promise<GitManager | null> {
		if (this.manager) return this.manager;
		if (!this.keyLoaded) return null;

		try {
			const gitCrypto = getModule<unknown>("git-remote-crypto");
			if (!gitCrypto) return null;

			const createFn = (
				gitCrypto as { createCryptoGitContext: () => GitManager }
			).createCryptoGitContext;
			const manager = createFn();

			const {
				transportType,
				repositoryUrl,
				localPath,
				branch,
				remoteName,
			} = plugin.settings;
			const baseProfile = {
				name: this.profileName,
				url: repositoryUrl,
				dir: localPath || ".git-encrypted",
				ref: branch || "main",
				remote: remoteName || "origin",
				key: this.masterKey as CryptoKey,
			};

			if (transportType === "ssh") {
				// SshRepoProfile — has privateKey field → resolveHttpClient auto-creates SSH transport.
				// Note: omit `fs` so resolveFs picks up node:fs automatically.
				const profile: SshRepoProfile = {
					...baseProfile,
					privateKey: plugin.settings.sshPrivateKeyText || "",
					port: plugin.settings.sshPort || 22,
				};
				if (plugin.settings.sshPassphrase) {
					profile.passphrase = plugin.settings.sshPassphrase;
				}
				manager.addProfile(profile as unknown as Record<string, unknown>);
			} else {
				// RepoProfile — no `fs` field → resolveFs auto-imports node:fs.
				// HTTP auth goes directly on the profile (extra fields for isomorphic-git).
				const profile: RepoProfile & {
					httpUsername?: string;
					httpToken?: string;
				} = {
					...baseProfile,
				};
				if (plugin.settings.httpUsername && plugin.settings.httpToken) {
					profile.httpUsername = plugin.settings.httpUsername;
					profile.httpToken = plugin.settings.httpToken;
				}
				manager.addProfile(profile as unknown as Record<string, unknown>);
			}

			this.manager = manager;
			return manager;
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			console.error(
				`GitEncrypt: Failed to initialize CryptoGitManager: ${message}`,
			);
			return null;
		}
	}

	/**
	 * Initialize (or clone) the local encrypted repository.
	 * Creates the `.git-encrypted/` directory structure with crypto configuration.
	 */
	async initRepo(plugin: GitEncryptPlugin): Promise<CryptoGitResult> {
		const manager = await this.getManager(plugin);
		if (!manager) {
			return {
				success: false,
				error: "CryptoGitManager not available (mobile or init failed)",
			};
		}

		try {
			await manager.init(this.profileName);
			return { success: true, message: "Repository initialized." };
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			return { success: false, error: `Init failed: ${message}` };
		}
	}

	/**
	 * Pull from remote — downloads and decrypts files.
	 */
	async cryptoPull(plugin: GitEncryptPlugin): Promise<CryptoGitResult> {
		const manager = await this.getManager(plugin);
		if (!manager) {
			return { success: false, error: "CryptoGitManager not available" };
		}

		try {
			await manager.pull(this.profileName);
			return {
				success: true,
				message: "Pulled and decrypted from remote.",
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			return { success: false, error: `Pull failed: ${message}` };
		}
	}

	/**
	 * Push to remote — encrypts and uploads files.
	 */
	async cryptoPush(plugin: GitEncryptPlugin): Promise<CryptoGitResult> {
		const manager = await this.getManager(plugin);
		if (!manager) {
			return { success: false, error: "CryptoGitManager not available" };
		}

		try {
			await manager.push(
				this.profileName,
				plugin.settings.remoteName || "origin",
			);
			return { success: true, message: "Pushed encrypted to remote." };
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			return { success: false, error: `Push failed: ${message}` };
		}
	}

	/**
	 * Stage all changes and commit.
	 */
	async cryptoCommit(
		plugin: GitEncryptPlugin,
		message?: string,
	): Promise<CryptoGitResult> {
		const manager = await this.getManager(plugin);
		if (!manager) {
			return { success: false, error: "CryptoGitManager not available" };
		}

		const commitMsg =
			message ||
			`Git Encrypt auto-commit ${new Date().toISOString().replace(/[:.]/g, "-")}`;
		const author = {
			name: plugin.settings.authorName || "Obsidian User",
			email: plugin.settings.authorEmail || "user@obsidian.md",
		};

		try {
			// Stage all files in the repo directory.
			await manager.add(this.profileName, ".");
			const sha = await manager.commit(
				this.profileName,
				commitMsg,
				author,
			);
			return {
				success: true,
				output: sha,
				message: `Committed: ${sha.slice(0, 12)}`,
			};
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			return { success: false, error: `Commit failed: ${message}` };
		}
	}

	/**
	 * Get status of the encrypted repository.
	 * git-remote-crypto doesn't have a direct status() method — return failure.
	 * Callers should fall back to plain git status (e.g. via SystemService).
	 */
	async cryptoStatus(): Promise<CryptoGitResult> {
		return { success: false, error: "No status API in git-remote-crypto" };
	}
}

/**
 * Singleton instance — created on first access.
 */
let instance: CryptoGitService | null = null;

export function getCryptoGitService(): CryptoGitService {
	if (!instance) {
		instance = new CryptoGitService();
	}
	return instance;
}
