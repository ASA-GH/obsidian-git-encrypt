import { describe, it, expect } from "vitest";
import { isValidEmail, isValidHexKey } from "../src/settings/validators";
import { DEFAULT_SETTINGS } from "../src/settings";
import type { GitEncryptSettings } from "../src/settings";

describe("isValidEmail", () => {
	it("accepts valid emails", () => {
		expect(isValidEmail("user@example.com")).toBe(true);
		expect(isValidEmail("a@b.cd")).toBe(true);
		expect(isValidEmail("user.name@domain.co.uk")).toBe(true);
		expect(isValidEmail("user+tag@example.org")).toBe(true);
	});

	it("rejects invalid emails", () => {
		expect(isValidEmail("")).toBe(false);
		expect(isValidEmail("no-at-sign")).toBe(false);
		expect(isValidEmail("@nodomain.com")).toBe(false);
		expect(isValidEmail("no-at-sign.com")).toBe(false);
		expect(isValidEmail("user@")).toBe(false);
		expect(isValidEmail("user@.com")).toBe(false);
		expect(isValidEmail("user name@example.com")).toBe(false);
	});
});

describe("isValidHexKey", () => {
	it("accepts valid 32-byte hex keys", () => {
		expect(
			isValidHexKey(
				"0000000000000000000000000000000000000000000000000000000000000000",
			),
		).toBe(true);
		expect(
			isValidHexKey(
				"9f8e7d6c5b4a39281f0e9d8c7b6a59483f2e1d0c9b8a79685f4e3d2c1b0a9988",
			),
		).toBe(true);
		expect(
			isValidHexKey(
				"FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF",
			),
		).toBe(true);
	});

	it("rejects invalid keys", () => {
		// Too short
		expect(isValidHexKey("abc123")).toBe(false);
		expect(
			isValidHexKey(
				"000000000000000000000000000000000000000000000000000000000000000",
			),
		).toBe(false); // 63 chars
		// Too long
		expect(
			isValidHexKey(
				"00000000000000000000000000000000000000000000000000000000000000000",
			),
		).toBe(false); // 65 chars
		// Invalid characters
		expect(
			isValidHexKey(
				"000000000000000000000000000000000000000000000000000000000000000g",
			),
		).toBe(false);
		expect(
			isValidHexKey(
				"xyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzxyzx",
			),
		).toBe(false);
		// Empty
		expect(isValidHexKey("")).toBe(false);
	});
});

describe("DEFAULT_SETTINGS", () => {
	it("exports a complete settings object", () => {
		// Verify all required properties exist
		const keys = Object.keys(DEFAULT_SETTINGS) as Array<
			keyof GitEncryptSettings
		>;
		const expectedKeys: Array<keyof GitEncryptSettings> = [
			"authorEmail",
			"authorName",
			"authorSource",
			"autoPullOnStart",
			"autoPushOnClose",
			"branch",
			"conflictAction",
			"encryptedMasterKey",
			"excludePatterns",
			"httpToken",
			"httpUsername",
			"localPath",
			"masterKeyFilePath",
			"masterKeyHex",
			"masterKeySource",
			"remoteName",
			"repositoryUrl",
			"sshKeySource",
			"sshPassphrase",
			"sshPort",
			"sshPrivateKeyPath",
			"sshPrivateKeyText",
			"syncIntervalMinutes",
			"transportType",
		];

		expect(keys).toHaveLength(expectedKeys.length);
		for (const key of expectedKeys) {
			expect(DEFAULT_SETTINGS).toHaveProperty(key);
		}
	});

	it("has sensible defaults", () => {
		expect(DEFAULT_SETTINGS.branch).toBe("main");
		expect(DEFAULT_SETTINGS.remoteName).toBe("origin");
		expect(DEFAULT_SETTINGS.transportType).toBe("https");
		expect(DEFAULT_SETTINGS.conflictAction).toBe("ask");
		expect(DEFAULT_SETTINGS.autoPullOnStart).toBe(false);
		expect(DEFAULT_SETTINGS.autoPushOnClose).toBe(false);
		expect(DEFAULT_SETTINGS.sshPort).toBe(22);
		expect(DEFAULT_SETTINGS.syncIntervalMinutes).toBe(0);
		expect(DEFAULT_SETTINGS.authorSource).toBe("manual");
		expect(DEFAULT_SETTINGS.sshKeySource).toBe("manual");
		expect(DEFAULT_SETTINGS.masterKeySource).toBe("manual");
	});

	it("excludePatterns uses real newlines, not literal backslash-n", () => {
		// Bug fix: previous default used literal "\n" instead of actual newline characters
		expect(DEFAULT_SETTINGS.excludePatterns).not.toContain("\\n");
		expect(DEFAULT_SETTINGS.excludePatterns).toContain("\n");
	});
});
