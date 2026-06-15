import { Platform } from "obsidian";

/**
 * Safely retrieves a native Node.js or Electron module if available on the current platform.
 * Returns null on mobile or if the runtime environment restricts node integration.
 *
 * @param moduleName - The name of the built-in Node.js or Electron module to load.
 * @returns The resolved module instance object, or null if unavailable.
 */
export function getNativeModule(
	moduleName: "fs" | "path" | "os" | "crypto" | "child_process" | "electron",
): unknown {
	if (Platform.isMobile) return null;
	const globalContext = globalThis as Record<string, unknown>;

	if (typeof globalContext.require !== "function") {
		return null;
	}
	const requireFn = globalContext.require as (mod: string) => unknown;

	try {
		if (moduleName === "electron") {
			if (globalContext.electron !== undefined) {
				return globalContext.electron;
			}
			return requireFn("electron");
		}
		return requireFn(moduleName);
	} catch (error) {
		console.error(
			`GitEncrypt: Failed to load native module [${moduleName}]:`,
			error,
		);
		return null;
	}
}
