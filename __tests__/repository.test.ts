import { describe, it, expect } from "vitest";
import { validateRepositoryUrl } from "../src/settings/validators";

describe("validateRepositoryUrl", () => {
	it("accepts empty string", () => {
		expect(validateRepositoryUrl("", "https")).toEqual({ valid: true });
		expect(validateRepositoryUrl("", "ssh")).toEqual({ valid: true });
		expect(validateRepositoryUrl("   ", "https")).toEqual({ valid: true });
	});

	it("accepts valid HTTPS URLs", () => {
		expect(
			validateRepositoryUrl("https://github.com/user/repo.git", "https"),
		).toEqual({ valid: true });
		expect(
			validateRepositoryUrl(
				"https://gitlab.com/user/group/repo.git",
				"https",
			),
		).toEqual({ valid: true });
		expect(
			validateRepositoryUrl(
				"https://github.com/user/repo.git  ",
				"https",
			),
		).toEqual({ valid: true }); // trimmed
	});

	it("accepts valid SSH URLs", () => {
		expect(
			validateRepositoryUrl("git@github.com:user/repo.git", "ssh"),
		).toEqual({ valid: true });
		expect(
			validateRepositoryUrl("git@gitlab.com:user/repo.git", "ssh"),
		).toEqual({ valid: true });
	});

	it("rejects HTTPS URL with SSH transport", () => {
		const result = validateRepositoryUrl(
			"https://github.com/user/repo.git",
			"ssh",
		);
		expect(result).toEqual({
			valid: false,
			message: "Invalid ssh url: must start with git@",
		});
	});

	it("rejects SSH URL with HTTPS transport", () => {
		const result = validateRepositoryUrl(
			"git@github.com:user/repo.git",
			"https",
		);
		expect(result).toEqual({
			valid: false,
			message: "Invalid https url: must start with https://",
		});
	});

	it("rejects URLs missing the required prefix", () => {
		const result = validateRepositoryUrl(
			"github.com/user/repo.git",
			"https",
		);
		expect(result).toMatchObject({ valid: false });
		if (!result.valid) {
			expect(result.message).toContain("https://");
		}

		const result2 = validateRepositoryUrl(
			"gitlab.com/user/repo.git",
			"ssh",
		);
		expect(result2).toMatchObject({ valid: false });
		if (!result2.valid) {
			expect(result2.message).toContain("git@");
		}

		expect(validateRepositoryUrl("not-a-url", "https")).toMatchObject({
			valid: false,
		});
	});
});
