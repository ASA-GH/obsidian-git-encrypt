import { isMobile } from "../settings/platform";

export { isMobile };

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
	if (isMobile) return null;
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

/**
 * Type-safe wrapper around getNativeModule that eliminates repetitive `as T` casts.
 * Callers specify the expected interface via the generic parameter.
 *
 * @example
 * const path = getModule<PathModule>("path");
 */
export function getModule<T>(moduleName: string): T | null {
	const raw = getNativeModule(
		moduleName as "fs" | "path" | "os" | "crypto" | "child_process" | "electron",
	);
	return (raw ?? null) as T | null;
}
