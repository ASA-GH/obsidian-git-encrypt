/**
 * Action types to handle merge conflicts during synchronization.
 */
export type ConflictAction = "ask" | "abort" | "theirs" | "ours";

/**
 * Transport protocols used for remote Git communication.
 */
export type TransportType = "https" | "ssh";

/**
 * Configuration settings for the Git Encrypt Obsidian plugin.
 * Handles repository metadata, authentication, author details, encryption keys, and automation.
 */
export interface GitEncryptSettings {
	/** Transport protocol for Git remote communication */
	transportType: TransportType;

	/** Full URL of the remote Git repository */
	repositoryUrl: string;

	/** Target Git branch for synchronization */
	branch: string;

	/** Name of the remote tracker (usually 'origin') */
	remoteName: string;

	/** Relative vault path to the folder being synchronized */
	localPath: string;

	/** Username used for HTTPS authentication */
	httpUsername: string;

	/** Personal Access Token (PAT) used for HTTPS authentication (masked in UI) */
	httpToken: string;

	/** Source for retrieving the SSH private key (desktop only can use 'git') */
	sshKeySource: "git" | "manual";

	/** Absolute file path to the SSH private key (desktop only) */
	sshPrivateKeyPath: string;

	/** Raw SSH private key text content (fallback or mobile input) */
	sshPrivateKeyText: string;

	/** Optional passphrase for the encrypted SSH private key (masked in UI) */
	sshPassphrase?: string;

	/** SSH network connection port */
	sshPort: number;

	/** Source for Git commit author information (desktop only can use 'git') */
	authorSource: "git" | "manual";

	/** Name of the commit author */
	authorName: string;

	/** Email address of the commit author */
	authorEmail: string;

	/** Source for reading the master encryption key (desktop only can use 'file') */
	masterKeySource: "file" | "manual";

	/** Path to the external file containing the master key hex string */
	masterKeyFilePath: string;

	/** 64-character hex encoded master key (32 bytes) */
	masterKeyHex: string;

	/** Automatically pull remote changes when Obsidian starts */
	autoPullOnStart: boolean;

	/** Automatically push local changes when Obsidian closes */
	autoPushOnClose: boolean;

	/** Interval in minutes for automatic sync checks (0 to disable) */
	syncIntervalMinutes: number;

	/** Comma-separated or newline-separated glob patterns to exclude from encryption */
	excludePatterns: string;

	/** Strategy used to resolve sync conflicts */
	conflictAction: ConflictAction;
}
