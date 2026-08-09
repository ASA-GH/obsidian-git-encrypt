import obsidianmd from "eslint-plugin-obsidianmd";
import globals from "globals";
import { defineConfig, globalIgnores } from "eslint/config";

const projectRoot = new URL(".", import.meta.url).pathname;

const obsidianConfigs = obsidianmd.configs?.recommended ?? [];

export default defineConfig(
	{
		languageOptions: {
			globals: {
				...globals.browser,
			},
			parserOptions: {
				projectService: {
					allowDefaultProject: [
						"eslint.config.mts",
						"manifest.json",
						"vitest.config.ts",
						"__tests__/repository.test.ts",
						"__tests__/setup.ts",
						"__tests__/systemService.test.ts",
						"__tests__/validators.test.ts",
					],
				},
				tsconfigRootDir: projectRoot,
				extraFileExtensions: [".json"],
			},
		},
	},
	...(obsidianConfigs as unknown as Record<string, unknown>[]),
	{
		plugins: {
			obsidianmd: obsidianmd,
		},
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
		"eslint.config.mts",
		"version-bump.mjs",
		"versions.json",
		"main.js",
	]),
);
