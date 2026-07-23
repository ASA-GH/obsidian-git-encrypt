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
