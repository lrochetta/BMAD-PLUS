const { verifyArchiveEntries } = require('../../tools/release/check-ghostwriter-consumer');

describe('Ghostwriter consumer release boundary', () => {
  test.each([
    'package/docs/private/roadmap.md',
    'package/audit/ghostwriter/notes.md',
    'package/README-GOLDEN.md',
    'package/src/bmad-plus/packs/pack-ghostwriter/BMAD_PLUS_GHOSTWRITER_PACK_SPEC.md',
    'package/src/../docs/notes.md',
    'outside/package.json',
  ])('refuses a private or unexpected archive member: %s', (entry) => {
    expect(() => verifyArchiveEntries([entry])).toThrow();
  });

  test('accepts the public README and shipped specialist instructions', () => {
    expect(() =>
      verifyArchiveEntries([
        'package/README.md',
        'package/src/bmad-plus/packs/pack-ghostwriter/workshops/three-act/specialist.md',
      ])
    ).not.toThrow();
  });
});
