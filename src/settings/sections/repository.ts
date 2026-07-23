import { Notice, Platform, Setting } from "obsidian";
import type GitEncryptPlugin from "../../main";
import { createSettingGroup } from "../ui";

/**
 * Validates a repository URL against the selected transport protocol.
 * @returns true if valid, false if invalid.
 */
function validateRepositoryUrl(
	repositoryUrl: string,
	transportType: "https" | "ssh",
): boolean {
	const trimmed = repositoryUrl.trim();
	if (!trimmed) {
		return true; // empty is allowed — user hasn't filled it in yet
	}
	if (transportType === "https") {
		if (!trimmed.startsWith("https://")) {
			new Notice("Invalid https url: must start with https://", 6000);
			return false;
		}
	} else {
		if (!trimmed.startsWith("git@")) {
			new Notice(
				"Invalid SSH url: must start with git@",
				6000,
			);
			return false;
		}
	}
	return true;
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
					plugin.settings.repositoryUrl = val.trim();
					if (validateRepositoryUrl(val.trim(), plugin.settings.transportType)) {
						await plugin.saveSettings();
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

	if (!Platform.isMobile) {
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
