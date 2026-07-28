/**
 * Shared validation utilities for settings sections.
 * Centralized so they can be updated or tested in one place.
 */

/**
 * Validates an email address with a simple format check.
 * Requires characters before '@', followed by a domain with at least one dot.
 */
export function isValidEmail(email: string): boolean {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validates a 32-byte hex-encoded master key.
 * Exactly 64 hexadecimal characters.
 */
export function isValidHexKey(key: string): boolean {
	return /^[0-9a-fA-F]{64}$/.test(key);
}

/**
 * Result of validating a repository URL against the selected transport protocol.
 */
export type ValidationResult =
	| { valid: true }
	| { valid: false; message: string };

/**
 * Validates a repository URL against the selected transport protocol.
 * Pure function — no side effects. Callers decide how to surface errors.
 */
export function validateRepositoryUrl(
	repositoryUrl: string,
	transportType: "https" | "ssh",
): ValidationResult {
	const trimmed = repositoryUrl.trim();
	if (!trimmed) return { valid: true };

	const expectedPrefix = transportType === "https" ? "https://" : "git@";
	if (!trimmed.startsWith(expectedPrefix)) {
		return {
			valid: false,
			message: `Invalid ${transportType} url: must start with ${expectedPrefix}`,
		};
	}
	return { valid: true };
}
