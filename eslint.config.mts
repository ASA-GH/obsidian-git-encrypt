import tseslint from "typescript-eslint";
import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { globalIgnores } from "eslint/config";

const projectRoot =
	typeof __dirname === "undefined"
		? new URL(".", import.meta.url).pathname
		: __dirname;

const obsidianConfigs = obsidianmd.configs?.recommended ?? [];

export default tseslint.config(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: ["eslint.config.js", "manifest.json"],
				},
				tsconfigRootDir: projectRoot,
				extraFileExtensions: [".json"],
			},
		},
	},
	...(obsidianConfigs as unknown as Record<string, unknown>[]),
	{
		rules: {
			"obsidianmd/ui/sentence-case": [
				"warn",
				{
					ignoreWords: [".git-encrypted"],
				},
			],
		},
	},
	globalIgnores([
		"node_modules",
		"dist",
		"esbuild.config.mjs",
		"eslint.config.js",
		"version-bump.mjs",
		"versions.json",
		"main.js",
	]),
);
