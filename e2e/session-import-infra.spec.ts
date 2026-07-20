import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import {
	getInitializedAgentCount,
	materializeSessionImportFixture,
	removeSessionImportFixture,
	type SessionImportFixture,
} from "./support/session-import-fixture";

const vaultPath = fileURLToPath(
	new URL("../test/vaults/simple", import.meta.url),
);
let fixture: SessionImportFixture;

describe("session import E2E infrastructure", () => {
	before(async () => {
		fixture = await materializeSessionImportFixture(vaultPath);
	});

	after(async () => {
		await removeSessionImportFixture(fixture);
	});

	it("creates a generic bundle without starting an Agent", async () => {
		const descriptor = JSON.parse(
			await readFile(fixture.descriptorPath, "utf8"),
		);
		const manifest = JSON.parse(
			await readFile(`${fixture.bundleDirectory}/manifest.json`, "utf8"),
		);

		expect(descriptor.schemaVersion).toBe(1);
		expect(manifest.sourceKind).toBe("fixture");
		expect(await getInitializedAgentCount()).toBe(0);
	});
});
