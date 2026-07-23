import type { GitEncryptSettings } from "./types";

/**
 * Default configuration values for the Git Encrypt plugin.
 * Used for initial state creation and settings reset fallbacks.
 */
export const DEFAULT_SETTINGS: GitEncryptSettings = {
	authorEmail: "user@obsidian.md",
	authorName: "Obsidian User",
	authorSource: "manual",
	autoPullOnStart: false,
	autoPushOnClose: false,
	branch: "main",
	conflictAction: "ask",
	encryptedMasterKey: "",
	excludePatterns: ".obsidian\n.trash\ntemp.*",
	httpToken: "",
	httpUsername: "",
	localPath: ".git-encrypted",
	masterKeyFilePath: "",
	masterKeyHex: "",
	masterKeySource: "manual",
	remoteName: "origin",
	repositoryUrl: "",
	sshKeySource: "manual",
	sshPassphrase: "",
	sshPort: 22,
	sshPrivateKeyPath: "",
	sshPrivateKeyText: "",
	syncIntervalMinutes: 0,
	transportType: "https",
};
