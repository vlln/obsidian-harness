/// <reference types="wdio-obsidian-service" />
import * as path from "path";
import chromedriver from "chromedriver";
export const config: WebdriverIO.Config = {
	runner: "local",
	services: ["obsidian"],
	cacheDir: path.resolve(".obsidian-cache"),
	specs: ["./e2e/demo-vault-verify.spec.ts"],
	maxInstances: 1,
	framework: "mocha",
	mochaOpts: { ui: "bdd", timeout: 60000 },
	reporters: ["spec"],
	capabilities: [{
		browserName: "obsidian",
		"wdio:obsidianOptions": {
			binaryPath: "/Applications/Obsidian.app/Contents/MacOS/Obsidian",
			appPath: "/Applications/Obsidian.app",
			plugins: ["."],
			vault: "demo-vault",
			copy: false,
		},
		"wdio:chromedriverOptions": { binary: chromedriver.path },
	}],
	logLevel: "warn",
};
