/// <reference types="wdio-obsidian-service" />

import * as path from "path";
import chromedriver from "chromedriver";

export const config: WebdriverIO.Config = {
	runner: "local",

	// Use wdio-obsidian-service which manages Obsidian lifecycle
	services: ["obsidian"],

	// Cache downloaded Obsidian versions
	cacheDir: path.resolve(".obsidian-cache"),

	// Test specs
	specs: ["./e2e/**/*.spec.ts"],

	// How many instances of Obsidian to run in parallel
	maxInstances: 1,

	// Framework
	framework: "mocha",
	mochaOpts: {
		ui: "bdd",
		timeout: 60000,
	},

	// Reporters
	reporters: ["spec"],

	// Capabilities
	capabilities: [
		{
			browserName: "obsidian",
			"wdio:obsidianOptions": {
				// Use local Obsidian installation to avoid downloading
				binaryPath: "/Applications/Obsidian.app/Contents/MacOS/Obsidian",
				appPath: "/Applications/Obsidian.app",
				plugins: ["."],
				vault: "test/vaults/simple",
				copy: false,
			},
			"wdio:chromedriverOptions": {
				// Use npm-installed chromedriver to avoid downloading
				binary: chromedriver.path,
			},
		},
	],

	// Log level
	logLevel: "warn",
};
