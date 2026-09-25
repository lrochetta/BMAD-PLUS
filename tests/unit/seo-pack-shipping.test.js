/**
 * BMAD+ SEO pack — ships the scripts it commands (NS-03 / PROD-02 / ARCH-02)
 *
 * For three audit cycles the SEO pack was "broken on arrival" from npm: the
 * shipped SKILL.md told agents to run `scripts/seo_fetch.py`, `pip install -r
 * requirements.txt`, etc., while the Python toolkit lived only in oveanet-pack/
 * — a directory excluded from package.json "files". A user installing from npm
 * received prompts pointing at files that were never delivered.
 *
 * The fix embarked the toolkit inside src/bmad-plus/packs/pack-seo (which IS
 * shipped) and wired provisioning to that path. These tests fail if any of that
 * regresses: a missing script, a dropped requirements.txt, a SKILL.md pointing
 * at a file the pack does not contain, "files" no longer covering the pack, the
 * installer's requirements path escaping the shipped tree, or the SSRF guard
 * disappearing from the embarked crawler/fetcher.
 *
 * Run: npx jest tests/unit/seo-pack-shipping.test.js --coverage=false
 */

const fs = require('node:fs');
const path = require('node:path');

const REPO = path.join(__dirname, '..', '..');
const PACK = path.join(REPO, 'src', 'bmad-plus', 'packs', 'pack-seo');
const SKILL = path.join(PACK, 'SKILL.md');

const skillText = fs.readFileSync(SKILL, 'utf8');

/** Every `scripts/<name>.py` path the SKILL.md commands the agent to run. */
function referencedScripts(text) {
  const set = new Set();
  const re = /scripts\/([A-Za-z0-9_]+\.py)/g;
  let m;
  while ((m = re.exec(text)) !== null) set.add(m[1]);
  return [...set];
}

/** Every `seo-*.md` agent file referenced anywhere in the SKILL.md. */
function referencedAgents(text) {
  const set = new Set();
  const re = /(seo-[a-z]+\.md)/g;
  let m;
  while ((m = re.exec(text)) !== null) set.add(m[1]);
  return [...set];
}

describe('SEO pack ships what its SKILL.md commands', () => {
  test('every scripts/*.py referenced by SKILL.md exists in the shipped pack', () => {
    const refs = referencedScripts(skillText);
    expect(refs.length).toBeGreaterThan(0);
    for (const script of refs) {
      const p = path.join(PACK, 'scripts', script);
      expect(fs.existsSync(p)).toBe(true);
    }
  });

  test('requirements.txt is shipped in-pack and lists the verified modules', () => {
    const req = path.join(PACK, 'requirements.txt');
    expect(fs.existsSync(req)).toBe(true);
    const text = fs.readFileSync(req, 'utf8');
    // install.js verifyModules for seo: requests, bs4(beautifulsoup4), defusedxml, lxml
    expect(text).toMatch(/requests/);
    expect(text).toMatch(/beautifulsoup4/);
    expect(text).toMatch(/defusedxml/);
    expect(text).toMatch(/lxml/);
  });

  test('every agent Load:d by SKILL.md exists at the pack root (packaged layout)', () => {
    const refs = referencedAgents(skillText);
    expect(refs).toEqual(expect.arrayContaining(['seo-scout.md', 'seo-chief.md', 'seo-judge.md']));
    for (const agent of refs) {
      expect(fs.existsSync(path.join(PACK, agent))).toBe(true);
    }
  });
});

describe('SEO pack is reachable from an npm install', () => {
  test('package.json "files" covers the pack directory', () => {
    const pkg = require(path.join(REPO, 'package.json'));
    const covered = pkg.files.some((f) => 'src/bmad-plus'.startsWith(f.replace(/\/$/, '')));
    expect(covered).toBe(true);
  });

  test('installer resolves seo requirements to the shipped, in-pack path', () => {
    const { DERIVED } = require('../../tools/cli/lib/packs');
    const requirements = DERIVED.pythonPacks.seo.requirements;
    expect(requirements).toEqual(['src', 'bmad-plus', 'packs', 'pack-seo', 'requirements.txt']);
    expect(fs.existsSync(path.join(REPO, ...requirements))).toBe(true);
  });
});

describe('registry python wiring points at the shipped, in-pack toolkit', () => {
  const registry = fs.readFileSync(path.join(REPO, 'registry.yaml'), 'utf8');

  test('seo python_package + python_entry resolve to a shipped file', () => {
    const pkgMatch = registry.match(/python_package:\s*(\S*pack-seo\S*)/);
    const entryMatch = registry.match(/python_entry:\s*(\S+)/);
    expect(pkgMatch).not.toBeNull();
    expect(entryMatch).not.toBeNull();
    const pythonPackage = pkgMatch[1];
    const pythonEntry = entryMatch[1];
    // must live under a shipped "files" root (not oveanet-pack, which is excluded)
    expect(pythonPackage.startsWith('src/bmad-plus')).toBe(true);
    // the entry script the installer smoke-runs must actually exist in the shipped tree
    expect(fs.existsSync(path.join(REPO, pythonPackage, pythonEntry))).toBe(true);
  });
});

describe('embarked SEO scripts keep their SSRF hardening', () => {
  test('seo_fetch.py fails closed and blocks private/redirect SSRF', () => {
    const text = fs.readFileSync(path.join(PACK, 'scripts', 'seo_fetch.py'), 'utf8');
    expect(text).toMatch(/def is_safe_url/);
    expect(text).toMatch(/Fails CLOSED/i);
    // per-hop redirect revalidation
    expect(text).toMatch(/allow_redirects=False/);
  });

  test('seo_crawl.py revalidates every redirect hop (no allow_redirects=True)', () => {
    const text = fs.readFileSync(path.join(PACK, 'scripts', 'seo_crawl.py'), 'utf8');
    expect(text).toMatch(/from seo_fetch import is_safe_url/);
    expect(text).toMatch(/allow_redirects=False/);
    expect(text).not.toMatch(/allow_redirects=True/);
  });
});
