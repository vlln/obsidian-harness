import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const vectorPath = fileURLToPath(
	new URL(
		"./fixtures/session-import/contracts/contract-smoke.json",
		import.meta.url,
	),
);

describe("session importer contract infrastructure", () => {
	it("loads the shared contract vector from TypeScript", async () => {
		const vector = JSON.parse(await readFile(vectorPath, "utf8")) as {
			schemaVersion: number;
			importNamespace: string;
			contract: string;
		};

		expect(vector).toMatchObject({
			schemaVersion: 1,
			importNamespace: "5ad9d0b0-c511-423c-84d6-64aedca2a19a",
			contract: "session-import-bundle",
		});
	});
});
