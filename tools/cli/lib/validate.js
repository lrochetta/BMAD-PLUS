/**
 * BMAD+ User Input Validation Utilities
 * Extracted from install.js for modularity and reuse.
 */

// Shell/quote metacharacters that are dangerous in user-provided names.
// Includes single/double quotes so a name cannot break out of a quoted context.
const SHELL_META = /[;&|`$(){}[\]!#~<>*?\\'"\n\r]/;
// Global variant used to strip EVERY occurrence during sanitization.
// (A non-global regex in String.replace only removes the first match.)
const SHELL_META_GLOBAL = /[;&|`$(){}[\]!#~<>*?\\'"\n\r]/g;

/**
 * Validate and sanitize a user name.
 * Rules:
 *  - Must not be empty
 *  - Must not exceed 100 characters
 *  - Must not contain shell metacharacters
 *
 * @param {string} rawName - Raw user-provided name
 * @param {string} fallback - Fallback name if validation fails
 * @returns {{ name: string, warnings: string[] }} Sanitized name and any warnings
 */
function validateUserName(rawName, fallback) {
  const warnings = [];

  if (!rawName || rawName.trim().length === 0) {
    warnings.push('Name cannot be empty. Using default.');
    return { name: fallback, warnings };
  }

  if (rawName.length > 100) {
    warnings.push('Name too long (>100 chars). Truncating.');
    return { name: rawName.slice(0, 100), warnings };
  }

  if (SHELL_META.test(rawName)) {
    const sanitized = rawName.replace(SHELL_META_GLOBAL, '').trim() || 'Developer';
    warnings.push('Name contains shell metacharacters. Using sanitized version.');
    return { name: sanitized, warnings };
  }

  return { name: rawName, warnings };
}

module.exports = {
  validateUserName,
  SHELL_META,
  SHELL_META_GLOBAL,
};
