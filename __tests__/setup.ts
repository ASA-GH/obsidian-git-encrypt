import { vi } from "vitest";

// Minimal Obsidian runtime mock — only what the settings code needs.
vi.mock("obsidian", () => ({
	Platform: { isMobile: false },
	Setting: class Setting {},
	Notice: class Notice {
		constructor(_msg: string, _timeout?: number) {}
	},
	Plugin: class Plugin {},
	PluginSettingTab: class PluginSettingTab {},
}));
