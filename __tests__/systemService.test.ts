import type GitEncryptPlugin from "../src/main";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// isMobile is always false in desktop tests — mobile tests are separate.
let isMobile = false;
const mockGetModule = vi.fn<(...args: string[]) => unknown>();

// Top-level mock — hoisted before all tests.
vi.mock("../src/services/nodeContext", () => ({
	getModule: (...args: string[]) => mockGetModule(...args),
	get isMobile() { return isMobile; },
}));

function getPlugin(): GitEncryptPlugin {
	return { settings: {} } as unknown as GitEncryptPlugin;
}

async function createService() {
	// Dynamic import after vi.mock is active.
	const mod = await import("../src/services/systemService");
	return new mod.SystemService(getPlugin());
}

describe("SystemService.execDesktopCommand", () => {
	beforeEach(() => {
		isMobile = false;
		mockGetModule.mockReset();
	});
	afterEach(() => vi.clearAllMocks());

	it("returns stdout on success", async () => {
		mockGetModule.mockImplementation((name: string) => {
			if (name === "child_process") {
				return {
					exec: (_cmd: string, cb: (err: unknown, stdout: string) => void) => {
						cb(null, "  user@email.com  ");
					},
				};
			}
			return null;
		});
		const sys = await createService();
		const result = await sys.execDesktopCommand("git config --global user.email");
		expect(result).toBe("  user@email.com  ");
	});

	it("returns empty string when command produces no output", async () => {
		mockGetModule.mockImplementation((name: string) => {
			if (name === "child_process") {
				return {
					exec: (_cmd: string, cb: (err: unknown, stdout: string) => void) => {
						cb(null, "");
					},
				};
			}
			return null;
		});
		const sys = await createService();
		const result = await sys.execDesktopCommand("git config --global user.email");
		expect(result).toBe("");
	});

	it("returns empty string on command failure (stdout is empty)", async () => {
		mockGetModule.mockImplementation((name: string) => {
			if (name === "child_process") {
				return {
					exec: (_cmd: string, cb: (err: unknown, stdout: string) => void) => {
						cb(new Error("command failed"), "");
					},
				};
			}
			return null;
		});
		const sys = await createService();
		const result = await sys.execDesktopCommand("git config --global user.email");
		expect(result).toBe("");
	});

	it("returns null when child_process module unavailable", async () => {
		mockGetModule.mockReturnValue(null);
		const sys = await createService();
		const result = await sys.execDesktopCommand("any cmd");
		expect(result).toBe(null);
	});
});

describe("SystemService.getGitGlobalUser (desktop)", () => {
	beforeEach(() => {
		isMobile = false;
		mockGetModule.mockReset();
	});
	afterEach(() => vi.clearAllMocks());

	it("returns name and email from git config", async () => {
		let callOrder = 0;
		mockGetModule.mockImplementation((name: string) => {
			if (name === "child_process") {
				return {
					exec: (cmd: string, cb: (err: unknown, stdout: string) => void) => {
						callOrder++;
						if (callOrder === 1) cb(null, " Test User ");
						else cb(null, " test@example.com ");
					},
				};
			}
			return null;
		});
		const sys = await createService();
		const result = await sys.getGitGlobalUser();
		expect(result).toEqual({ name: "Test User", email: "test@example.com" });
	});

	it("returns null for unset git config", async () => {
		mockGetModule.mockImplementation((name: string) => {
			if (name === "child_process") {
				return {
					exec: (_cmd: string, cb: (err: unknown, stdout: string) => void) => {
						cb(null, "");
					},
				};
			}
			return null;
		});
		const sys = await createService();
		const result = await sys.getGitGlobalUser();
		expect(result).toEqual({ name: null, email: null });
	});
});

describe("SystemService.getGitSshKeyPath (desktop)", () => {
	beforeEach(() => {
		isMobile = false;
		mockGetModule.mockReset();
	});
	afterEach(() => vi.clearAllMocks());

	it("extracts key path from git core.sshCommand", async () => {
		mockGetModule.mockImplementation((name: string) => {
			if (name === "child_process") {
				return {
					exec: (_cmd: string, cb: (err: unknown, stdout: string) => void) => {
						cb(null, "ssh -i /home/test/.ssh/my_key");
					},
				};
			}
			if (name === "path") return { resolve: (p: string) => p, join: (...p: string[]) => p.join("/") };
			if (name === "os") return { homedir: () => "/home/test" };
			if (name === "fs") return { promises: { access: async () => {} } };
			return null;
		});
		const sys = await createService();
		const result = await sys.getGitSshKeyPath();
		expect(result).toBe("/home/test/.ssh/my_key");
	});

	it("falls back to default key paths", async () => {
		mockGetModule.mockImplementation((name: string) => {
			if (name === "child_process") {
				return {
					exec: (_cmd: string, cb: (err: unknown, stdout: string) => void) => {
						cb(null, "");
					},
				};
			}
			if (name === "path") return { join: (...p: string[]) => p.join("/") };
			if (name === "os") return { homedir: () => "/home/test" };
			if (name === "fs") return {
				promises: {
					access: async (p: string) => {
						if (p.includes("id_ed25519")) return;
						throw new Error("not found");
					},
				},
			};
			return null;
		});
		const sys = await createService();
		const result = await sys.getGitSshKeyPath();
		expect(result).toBe("/home/test/.ssh/id_ed25519");
	});

	it("returns null when modules unavailable", async () => {
		// Return null for all modules — the !path || !fs || !os guard triggers
		mockGetModule.mockImplementation((name: string) => {
			if (name === "child_process") {
				return {
					exec: (_cmd: string, cb: (err: unknown, stdout: string) => void) => {
						cb(null, "");
					},
				};
			}
			return null;
		});
		const sys = await createService();
		const result = await sys.getGitSshKeyPath();
		expect(result).toBe(null);
	});
});

describe("SystemService (mobile guard)", () => {
	beforeEach(() => {
		isMobile = true;
		mockGetModule.mockReset();
	});
	afterEach(() => vi.clearAllMocks());

	it("execDesktopCommand returns null on mobile", async () => {
		const sys = await createService();
		const result = await sys.execDesktopCommand("any cmd");
		expect(result).toBe(null);
	});

	it("getGitGlobalUser returns nulls on mobile", async () => {
		const sys = await createService();
		const result = await sys.getGitGlobalUser();
		expect(result).toEqual({ name: null, email: null });
	});

	it("getGitSshKeyPath returns null on mobile", async () => {
		const sys = await createService();
		const result = await sys.getGitSshKeyPath();
		expect(result).toBe(null);
	});
});
