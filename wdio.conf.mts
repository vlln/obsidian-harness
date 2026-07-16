/// <reference types="wdio-obsidian-service" />

export const config: WebdriverIO.Config = {
	// Use wdio-obsidian-service which manages Obsidian lifecycle
	services: ["obsidian"],

	// Obsidian service options
	obsidian: {
		// Sandbox vault — service creates a temp vault for testing
		sandbox: true,
	},

	// Test specs
	specs: ["./e2e/**/*.spec.ts"],

	// Framework
	framework: "mocha",

	// Reporters
	reporters: ["spec"],

	// Capabilities
	capabilities: [
		{
			browserName: "obsidian",
		},
	],

	// Log level
	logLevel: "info",
};