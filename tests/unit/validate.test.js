/**
 * BMAD+ Validate — Unit Tests
 * Tests for user name validation utility.
 */
const { validateUserName } = require('../../tools/cli/lib/validate');

describe('validate — User name validation', () => {
  test('validateUserName should accept valid names', () => {
    const result = validateUserName('laurent');
    expect(result.name).toBe('laurent');
    expect(result.warnings.length).toBe(0);
  });

  test('validateUserName should warn on empty name', () => {
    const result = validateUserName('');
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('validateUserName should use fallback for empty name', () => {
    const result = validateUserName('', 'Developer');
    expect(result.name).toBe('Developer');
  });

  test('validateUserName should truncate names over 100 characters', () => {
    const longName = 'a'.repeat(150);
    const result = validateUserName(longName);
    expect(result.name.length).toBeLessThanOrEqual(100);
    expect(result.warnings.length).toBeGreaterThan(0);
  });

  test('validateUserName should reject shell metacharacters', () => {
    const result = validateUserName('evil; rm -rf /');
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.name).not.toContain(';');
  });
});
