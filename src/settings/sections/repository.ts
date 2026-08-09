import { Notice, Setting } from "obsidian";
import type GitEncryptPlugin from "../../main";
import { createSettingGroup, renderWarningCallout } from "../ui";
import { isMobilePlatform } from "../platform";
import { validateRepositoryUrl } from "../validators";
import type { TransportType } from "../types";

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

	// Warn when connecting an existing repository that already has data.
	if (plugin.settings.repositoryUrl.trim()) {
		renderWarningCallout(
			itemEl,
			"Existing repository detected",
			"You are connecting to a repository that already contains data. Your local vault files may be overwritten on the next pull. Make a backup of your vault before proceeding.",
			"Migration guide →",
			"user_scenarios.md#6-migration",
		);
	}

	// Explain what an encrypted remote repository is — always visible.
	const infoEl = itemEl.createDiv({
		cls: ["callout", "is-collapsible"],
		attr: { "data-callout": "info" },
	});
	infoEl.createDiv({ cls: "callout-title" }).createSpan({
		text: "Encrypted remote repository",
	});
	const bodyEl = infoEl.createDiv({ cls: "callout-content" });
	bodyEl.createEl("p", {
		text: "This plugin pushes encrypted blobs to the remote. "
			+ "Create the repository first, then paste its URL below. "
			+ "The remote will never contain plaintext notes.",
	});
	bodyEl.createEl("a", {
		href: "https://github.com/antonmedv/obsidian-git-encrypt/blob/main/README.md",
		text: "Learn more about how encryption works →",
	});

	new Setting(itemEl)
		.setName("Transport protocol")
		.setDesc("Choose the access method for your remote Git repository.")
		.addDropdown((dropdown) =>
			dropdown
				.addOption("https", "HTTPS")
				.addOption("ssh", "SSH")
				.setValue(plugin.settings.transportType)
				.onChange(async (val: string) => {
					plugin.settings.transportType = val as TransportType;
					await plugin.saveSettings();
					await plugin.refreshSettingsTab();
					// Directly update visible elements in case the tab re-render
					// doesn't pick up the change (Obsidian Setting uses innerHTML
					// and may not restore state after empty()).
					updateProtocolVisuals(dropdown, plugin);
				}),
		);

	const urlDesc =
		plugin.settings.transportType === "ssh"
			? "SSH address (e.g., git@github.com:user/repo.git)"
			: "HTTPS address (e.g., https://github.com/user/repo.git)";

	const frag = createFragment();
	frag.append(urlDesc);

	if (!plugin.settings.repositoryUrl.trim()) {
		frag.append(document.createTextNode("\n"));
		const steps = frag.appendChild(createDiv());
		steps.addClass("list");
		steps.addClass("list-numbers");
		steps.appendChild(document.createTextNode("1. "));
		steps.appendChild(createEl("strong")).textContent = "Create a repo on GitHub/GitLab";
		steps.appendChild(document.createTextNode("\n"));
		steps.appendChild(document.createTextNode("2. "));
		steps.appendChild(createEl("strong")).textContent = "Paste the URL here";
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

/**
 * Updates the URL field's description and placeholder to reflect the new protocol.
 * Called after transport type changes to ensure visual feedback even if the
 * tab re-render doesn't pick up the change (Obsidian Setting uses innerHTML).
 */
function updateProtocolVisuals(
	_dropdown: unknown,
	plugin: GitEncryptPlugin,
): void {
	const transport = plugin.settings.transportType;
	const isSsh = transport === "ssh";
	const containerEl = document.querySelector(".setting-group");
	if (!containerEl) return;

	// Find all setting items with text inputs, pick the one whose placeholder
	// contains a URL pattern (the Repository URL field).
	const items = Array.from(containerEl.querySelectorAll(".setting-item"));
	for (const item of items) {
		const input = item.querySelector("input");
		if (!input) continue;
		const nameEl = item.querySelector(".setting-item-name");
		if (nameEl?.textContent !== "Repository URL") continue;

		const descEl = item.querySelector(".setting-item-description");
		if (descEl) {
			descEl.textContent = isSsh
				? "SSH address (e.g., git@github.com:user/repo.git)"
				: "HTTPS address (e.g., https://github.com/user/repo.git)";
		}
		input.placeholder = isSsh
			? "git@github.com:user/repo.git"
			: "https://github.com/user/repo.git";
		break;
	}
}
