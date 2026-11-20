/** The redaction floor for notes and findings BMAD+ writes to disk. */
const { MARK, redact, redactFields } = require('../../tools/cli/lib/redact');

// Test credentials are assembled at run time so this file never contains one verbatim.
const token = (prefix, length, alphabet = 'aB3dE5gH7jK9mN1pQ2sT4vW6xY8z') =>
  prefix + Array.from({ length }, (_, i) => alphabet[i % alphabet.length]).join('');

describe('redaction floor', () => {
  it.each([
    ['GitHub token', `pushed with ${token('ghp_', 36)} today`],
    ['GitHub fine-grained token', `use ${token('github_pat_', 60)}`],
    ['npm token', `NPM ${token('npm_', 36)}`],
    ['GitLab token', token('glpat-', 24)],
    ['model API key', token('sk-ant-', 40)],
    ['Slack token', token('xoxb-', 30)],
    ['AWS access key id', `AKIA${'ABCDEFGHIJKLMNOP'}`],
    ['Google API key', token('AIza', 35)],
    ['JWT', `${token('eyJ', 20)}.${token('', 20)}.${token('', 20)}`],
  ])('replaces a %s', (_, text) => {
    const { text: out, found } = redact(text);
    expect(out).toContain(MARK);
    expect(Object.keys(found).length).toBeGreaterThan(0);
  });

  it('keeps the name of an assignment and hides its value', () => {
    const secret = token('', 24);
    expect(redact(`DB_PASSWORD=${secret}`).text).toBe(`DB_PASSWORD=${MARK}`);
    expect(redact(`"apiKey": "${secret}"`).text).toBe(`"apiKey": "${MARK}"`);
    expect(redact(`client_secret: '${secret}'`).text).toBe(`client_secret: '${MARK}'`);
  });

  it('leaves references to where a secret lives untouched', () => {
    for (const text of [
      'const API_KEY = process.env.API_KEY;',
      'token = os.environ["TOKEN"]',
      'NPM_TOKEN: ${{ secrets.NPM_TOKEN }}',
      'password = PASSWORD_FROM_VAULT',
      'secret: <your secret here>',
    ]) {
      expect(redact(text).text).toBe(text);
    }
    // An all-capitals random value is still a value, not a variable name.
    expect(redact(`api_key=${'QWERTYUIOPASDFGH'}`).text).toBe(`api_key=${MARK}`);
  });

  it('handles URLs with credentials, authorization headers and private keys', () => {
    expect(redact('git clone https://user:hunter22@example.com/repo.git').text).toBe(
      `git clone https://${MARK}@example.com/repo.git`
    );
    expect(redact(`Authorization: Bearer ${token('', 32)}`).text).toBe(
      `Authorization: Bearer ${MARK}`
    );
    const pem = [
      '-----BEGIN RSA PRIVATE KEY-----',
      token('', 64),
      '-----END RSA PRIVATE KEY-----',
    ].join('\n');
    expect(redact(`key:\n${pem}\nend`).text).toBe(`key:\n-----${MARK} PRIVATE KEY-----\nend`);
  });

  it('drops control characters, keeps tabs and line breaks, and caps the length', () => {
    const bell = String.fromCharCode(7);
    const escape = String.fromCharCode(27);
    expect(redact(`a${bell}b\tc\r\nd${escape}[31m`).text).toBe('ab\tc\r\nd[31m');
    const long = redact('x'.repeat(50), { maxLength: 10 });
    expect(long.text).toBe('xxxxxxxxxx […40 characters cut]');
    expect(long.found.truncated).toBe(1);
  });

  it('is idempotent and leaves ordinary text alone', () => {
    const once = redact(`token=${token('', 20)} and a normal sentence`).text;
    expect(redact(once).text).toBe(once);
    expect(redact('The loop reads items[items.length], which is undefined.').text).toBe(
      'The loop reads items[items.length], which is undefined.'
    );
  });

  it('redacts only the named string fields of a record and counts replacements', () => {
    const record = { note: `pat ${token('ghp_', 36)}`, keep: `pat ${token('ghp_', 36)}`, n: 3 };
    expect(redactFields(record, ['note', 'n', 'missing'])).toBe(1);
    expect(record.note).toBe(`pat ${MARK}`);
    expect(record.keep).not.toContain(MARK);
    expect(record.n).toBe(3);
  });
});
