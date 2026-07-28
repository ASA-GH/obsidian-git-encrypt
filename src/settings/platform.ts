import { Platform } from "obsidian";

/**
 * Platform detection wrapper.
 * Single import point for `Platform.isMobile` across the codebase.
 * Re-exported as `isMobile` for `nodeContext.ts` and as `isMobilePlatform` for section files.
 */
export const isMobile = Platform.isMobile;
export { isMobile as isMobilePlatform };
