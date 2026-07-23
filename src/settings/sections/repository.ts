import { Notice, Setting } from "obsidian";
import type GitEncryptPlugin from "../../main";
import { createSettingGroup } from "../ui";
import { isMobilePlatform } from "../platform";

/**
 * Result of validating a repository URL against the selected transport protocol.
 */
type ValidationResult =
	| { valid: true }
	| { valid: false; message: string };

const EXPECTED_PREFIXES: Record<"https" | "ssh", string> = {
	https: "https://",
	ssh: "git@",
};

/**
 * Validates a repository URL against the selected transport protocol.
 * Pure function — no side effects. Callers decide how to surface errors.
 */
function validateRepositoryUrl(
	repositoryUrl: string,
	transportType: "https" | "ssh",
): ValidationResult {
	const trimmed = repositoryUrl.trim();
	if (!trimmed) return { valid: true };

	const expectedPrefix = EXPECTED_PREFIXES[transportType];
	if (!trimmed.startsWith(expectedPrefix)) {
		return {
			valid: false,
			message: `Invalid ${transportType} url: must start with ${expectedPrefix}`,
		};
	}
	return { valid: true };
}

/**
 * Renders the repository connection settings section.
 * Handles protocol selection, repository URL, branch, and remote tracking name.
 * The local storage path is only shown on desktop.
 *
 * @param containerEl - The parent HTML element where the section will be rendered.
 * @param plugin - The main plugin instance containing settings and helper methods.
 */
export async function renderRepositorySection(
	containerEl: HTMLElement,
	plugin: GitEncryptPlugin,
): Promise<void> {
	const itemEl = createSettingGroup(containerEl, "Repository connection");

	if (!plugin.settings.repositoryUrl.trim()) {
		const infoEl = itemEl.createEl("div", {
			cls: ["callout", "is-collapsible"],
			attr: { "data-callout": "info" },
		});
		infoEl.createEl("div", { cls: "callout-title" }).createSpan({
			text: "Encrypted remote repository",
		});
		const bodyEl = infoEl.createEl("div", { cls: "callout-content" });
		bodyEl.createEl("p", {
			text: "This plugin pushes encrypted blobs to the remote. "
				+ "Create the repository first, then paste its URL below. "
				+ "The remote will never contain plaintext notes.",
		});
		bodyEl.createEl("a", {
			href: "https://github.com/antonmedv/obsidian-git-encrypt/blob/main/README.md",
			text: "Learn more about how encryption works →",
		});
	}

	new Setting(itemEl)
		.setName("Transport protocol")
		.setDesc("Choose the access method for your remote Git repository.")
		.addDropdown((dropdown) =>
			dropdown
				.addOption("https", "HTTPS")
				.addOption("ssh", "SSH")
				.setValue(plugin.settings.transportType)
				.onChange(async (val: "https" | "ssh") => {
					plugin.settings.transportType = val;
					await plugin.saveSettings();
					await plugin.refreshSettingsTab();
				}),
		);

	const urlDesc =
		plugin.settings.transportType === "ssh"
			? "SSH address (e.g., git@github.com:user/repo.git)"
			: "HTTPS address (e.g., https://github.com/user/repo.git)";

	const frag = document.createDocumentFragment();
	frag.append(urlDesc);

	if (!plugin.settings.repositoryUrl.trim()) {
		frag.append(document.createTextNode("\n"));
		const steps = frag.appendChild(document.createElement("div"));
		steps.style.cssText = "margin-top:4px;font-size:0.9em;";
		steps.appendChild(document.createTextNode("1. "));
		steps.appendChild(document.createElement("strong")).textContent = "Create a repo on GitHub/GitLab";
		steps.appendChild(document.createTextNode("\n"));
		steps.appendChild(document.createTextNode("2. "));
		steps.appendChild(document.createElement("strong")).textContent = "Paste the URL here";
	}

	new Setting(itemEl)
		.setName("Repository URL")
		.setDesc(frag)
		.addText((text) =>
			text
				.setPlaceholder(
					plugin.settings.transportType === "ssh"
						? "git@github.com:user/repo.git"
						: "https://github.com/user/repo.git",
				)
				.setValue(plugin.settings.repositoryUrl)
				.onChange(async (val) => {
					const result = validateRepositoryUrl(val.trim(), plugin.settings.transportType);
					if (result.valid) {
						plugin.settings.repositoryUrl = val.trim();
						await plugin.saveSettings();
					} else {
						new Notice(result.message, 6000);
					}
				}),
		);

	new Setting(itemEl)
		.setName("Branch")
		.setDesc("Target branch for synchronization.")
		.addText((text) =>
			text
				.setPlaceholder("'main'")
				.setValue(plugin.settings.branch)
				.onChange(async (val) => {
					plugin.settings.branch = val.trim();
					await plugin.saveSettings();
				}),
		);

	new Setting(itemEl)
		.setName("Remote name")
		.setDesc("Name of the remote tracker (usually 'origin').")
		.addText((text) =>
			text
				.setPlaceholder("'origin'")
				.setValue(plugin.settings.remoteName)
				.onChange(async (val) => {
					plugin.settings.remoteName = val.trim();
					await plugin.saveSettings();
				}),
		);

	if (!isMobilePlatform) {
		new Setting(itemEl)
			.setName("Local path")
			.setDesc(
				"Folder inside the vault where the encrypted Git repository will be located.",
			)
			.addText((text) =>
				text
					.setPlaceholder("Example: .git-encrypted")
					.setValue(plugin.settings.localPath)
					.onChange(async (val) => {
						plugin.settings.localPath = val.trim();
						await plugin.saveSettings();
					}),
			);
	}
}
