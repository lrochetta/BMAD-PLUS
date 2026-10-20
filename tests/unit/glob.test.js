/** Path patterns used by review scopes and rules. */
const { expandBraces, matches, matchesAny } = require('../../tools/cli/lib/glob');

describe('glob patterns', () => {
  it('expands every brace group, nested ones and empty options included', () => {
    expect(expandBraces('src/{a,b{c,d}}/*.{js,ts}')).toEqual([
      'src/a/*.js',
      'src/a/*.ts',
      'src/bc/*.js',
      'src/bc/*.ts',
      'src/bd/*.js',
      'src/bd/*.ts',
    ]);
    expect(expandBraces('**/{docker-,}compose.yml')).toEqual([
      '**/docker-compose.yml',
      '**/compose.yml',
    ]);
  });

  it('refuses an unbalanced brace and a pattern that explodes', () => {
    expect(() => expandBraces('src/{a,b')).toThrow(/unbalanced "\{"/);
    expect(() => expandBraces('src/a}')).toThrow(/unbalanced "\}"/);
    expect(() => expandBraces('{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}{a,b}')).toThrow(
      /more than 256/
    );
  });

  it('keeps * within one segment and lets ** span zero or more', () => {
    expect(matches('src/a.js', 'src/*.js')).toBe(true);
    expect(matches('src/deep/a.js', 'src/*.js')).toBe(false);
    expect(matches('a.js', '**/*.js')).toBe(true);
    expect(matches('x/y/z/a.js', '**/*.js')).toBe(true);
    expect(matches('.github/workflows/ci.yml', '.github/workflows/**/*.{yml,yaml}')).toBe(true);
    expect(matches('src/a.jsx', '**/*.js')).toBe(false);
  });

  it('treats regular-expression characters in a path literally', () => {
    expect(matches('src/a+b(c).js', 'src/a+b(c).js')).toBe(true);
    expect(matches('src/aab.js', 'src/a+b.js')).toBe(false);
    expect(matchesAny('Makefile', ['**/*.sh', '**/{Makefile,makefile}'])).toBe(true);
  });
});
