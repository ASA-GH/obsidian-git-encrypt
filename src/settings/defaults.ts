import type { GitEncryptSettings } from "./types";

/**
 * Default configuration values for the Git Encrypt plugin.
 * Used for initial state creation and settings reset fallbacks.
 */
export const DEFAULT_SETTINGS: GitEncryptSettings = {
	transportType: "https",
	repositoryUrl: "",
	branch: "main",
	remoteName: "origin",
	localPath: ".git-encrypted",
	httpUsername: "",
	httpToken: "",
	sshKeySource: "manual",
	sshPrivateKeyPath: "",
	sshPrivateKeyText: "",
	sshPassphrase: "",
	sshPort: 22,
	authorSource: "manual",
	authorName: "Obsidian User",
	authorEmail: "user@obsidian.md",
	masterKeySource: "manual",
	masterKeyFilePath: "",
	masterKeyHex: "",
	autoPullOnStart: false,
	autoPushOnClose: false,
	syncIntervalMinutes: 0,
	excludePatterns: "",
	conflictAction: "ask",
};
