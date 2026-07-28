import tsparser from "@typescript-eslint/parser";
import { defineConfig } from "eslint/config";
import obsidianmd from "eslint-plugin-obsidianmd";
import tseslint from "typescript-eslint";

export default defineConfig([
	{
		ignores: [
			"node_modules/",
			"main.js",
			"docs/",
			"e2e/",
			"test/vaults/*/.obsidian/app.json",
			"test/vaults/*/.obsidian/appearance.json",
			"test/vaults/*/.obsidian/workspace.json",
			"test/vaults/*/.obsidian/plugins/",
			"test/vaults/*/*.session",
		],
	},
	{
		files: ["scripts/**/*.mjs"],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: "module",
			globals: {
				console: "readonly",
				process: "readonly",
				URL: "readonly",
				ReadableStream: "readonly",
				WritableStream: "readonly",
			},
		},
	},
	...obsidianmd.configs.recommended,
	...tseslint.configs.recommended,
	{
		files: ["**/*.ts", "**/*.tsx"],
		languageOptions: {
			parser: tsparser,
			parserOptions: { project: "./tsconfig.eslint.json" },
		},
		rules: {
			// Preserve existing rules
			"@typescript-eslint/no-unused-vars": ["error", { args: "none" }],
			"@typescript-eslint/ban-ts-comment": "off",
			"@typescript-eslint/no-empty-function": "off",
		},
	},
]);
