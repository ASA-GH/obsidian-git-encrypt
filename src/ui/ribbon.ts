import { Menu, Notice } from "obsidian";
import GitEncryptPlugin from "../main";

/**
 * Ribbon icon and context menu for Git Encrypt.
 * Provides a single ribbon icon entry point that opens a menu
 * with Git operation shortcuts (status, commit, merge, pull, push).
 */
export class GitRibbon {
	private readonly plugin: GitEncryptPlugin;

	/**
	 * Creates a new GitRibbon instance.
	 *
	 * @param plugin - The main plugin instance.
	 */
	constructor(plugin: GitEncryptPlugin) {
		this.plugin = plugin;
	}

	/**
	 * Registers the ribbon icon in Obsidian's sidebar.
	 * Uses the "folder-git" icon with tooltip "Git Encrypt".
	 */
	register() {
		this.plugin.addRibbonIcon(
			"folder-git",
			"Git encrypt",
			(evt: MouseEvent) => {
				this.showGitMenu(evt);
			},
		);
	}

	/**
	 * Shows the context menu at the click position.
	 * Works on both desktop (mouse event) and mobile (touch).
	 */
	private showGitMenu(evt: MouseEvent) {
		const menu = new Menu();

		// 1. Status / Info
		menu.addItem((item) =>
			item
				.setTitle("Status")
				.setIcon("info")
				.onClick(async () => {
					await this.handleStatus();
				}),
		);

		menu.addSeparator();

		// 2. Stage & Commit
		menu.addItem((item) =>
			item
				.setTitle("Stage & commit")
				.setIcon("git-commit")
				.onClick(async () => {
					await this.handleCommit();
				}),
		);

		// 3. Merge
		menu.addItem((item) =>
			item
				.setTitle("Merge branch")
				.setIcon("git-merge")
				.onClick(async () => {
					await this.handleMerge();
				}),
		);

		// 4. Pull
		menu.addItem((item) =>
			item
				.setTitle("Pull (decrypt)")
				.setIcon("git-pull-request")
				.onClick(async () => {
					await this.handlePull();
				}),
		);

		// 5. Push
		menu.addItem((item) =>
			item
				.setTitle("Push (encrypt)")
				.setIcon("git-push")
				.onClick(async () => {
					await this.handlePush();
				}),
		);

		// Show menu at click/touch position
		menu.showAtMouseEvent(evt);
	}

	/** Helper: run an async Git operation and show result or error as a Notice. */
	private async runGitOp(
		name: string,
		promise: Promise<string | null>,
		onSuccess: (output: string) => string,
	): Promise<void> {
		try {
			const output = await promise;
			if (output) {
				new Notice(onSuccess(output), 6000);
			} else {
				new Notice(`${name} completed (no output).`, 6000);
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			new Notice(`${name} failed: ${message}`, 10000);
		}
	}

	/** Handle Status — show git status --short output (modified/added/deleted summary). */
	private async handleStatus() {
		try {
			const output = await this.plugin.sys.cryptoStatus();
			if (!output || output.trim() === "") {
				new Notice("Working tree clean — no changes.", 6000);
			} else {
				const lines = output.trim().split("\n");
				const modified = lines.filter((l) =>
					l.startsWith(" M") || l.startsWith(" M "),
				).length;
				const added = lines.filter((l) => l.startsWith("??")).length;
				const deleted = lines.filter((l) =>
					l.startsWith("D "),
				).length;
				const summary = [
					`${lines.length} change(s)`,
					modified ? `${modified} modified` : "",
					added ? `${added} untracked` : "",
					deleted ? `${deleted} deleted` : "",
				]
					.filter(Boolean)
					.join(", ");
				new Notice(`Git status: ${summary}`, 6000);
			}
		} catch (error) {
			const message =
				error instanceof Error ? error.message : String(error);
			new Notice(`Git status failed: ${message}`, 10000);
		}
	}

	/** Handle Commit — stage all and commit with timestamped message (via git-remote-crypto). */
	private async handleCommit() {
		await this.runGitOp(
			"Commit",
			this.plugin.sys.cryptoCommit(),
			(output) => `Committed: ${output.trim().slice(0, 50)}`,
		);
	}

	/** Handle Merge — merge the configured branch. */
	private async handleMerge() {
		const branch = this.plugin.settings.branch || "main";
		await this.runGitOp(
			"Merge",
			this.plugin.sys.gitMerge(branch),
			() => `Merged '${branch}' successfully.`,
		);
	}

	/** Handle Pull — pull from remote via git-remote-crypto (decrypts on-the-fly). */
	private async handlePull() {
		await this.runGitOp(
			"Pull",
			this.plugin.sys.cryptoPull(),
			(output) => output,
		);
	}

	/** Handle Push — push to remote via git-remote-crypto (encrypts on-the-fly). */
	private async handlePush() {
		await this.runGitOp(
			"Push",
			this.plugin.sys.cryptoPush(),
			(output) => output,
		);
	}
}
