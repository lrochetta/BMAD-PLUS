/** The backup agent promises to show the archive size: every variant that creates one must. */
const fs = require('node:fs');
const path = require('node:path');

const pack = path.resolve(__dirname, '../../src/bmad-plus/packs/pack-backup');
const FILES = ['backup-agent.md', 'templates/backup-workflow.md'];

function createBlocks(text) {
  const blocks = [...text.matchAll(/```(powershell|bash)\n([\s\S]*?)```/g)];
  return blocks
    .map(([, shell, body]) => ({ shell, body }))
    .filter(
      ({ body }) =>
        /_backup_\$(timestamp|TIMESTAMP)\.zip/.test(body) && /zip|Compress-Archive/.test(body)
    );
}

describe('backup pack archive size', () => {
  test.each(FILES)('%s: each create variant prints the size', (file) => {
    const blocks = createBlocks(fs.readFileSync(path.join(pack, file), 'utf8'));
    expect(blocks.map((b) => b.shell).sort()).toEqual(['bash', 'powershell']);
    for (const { shell, body } of blocks) {
      if (shell === 'bash') expect(body).toMatch(/du -h .*\.zip/);
      else expect(body).toMatch(/\.Length \/ 1MB/);
      expect(body).toMatch(/(echo|Write-Output) .*(\$SIZE|MB)/);
    }
  });
});
