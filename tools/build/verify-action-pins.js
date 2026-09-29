#!/usr/bin/env node
/**
 * Every third-party GitHub Action is pinned to a full commit SHA with its version beside it.
 *
 * A tag (`@v4`) can be moved by whoever controls the action; a 40-hex commit cannot. The
 * version comment keeps the pin reviewable and lets dependabot propose updates. Local
 * reusable workflows (`uses: ./…`) and `docker://` images pinned by digest are accepted.
 * Fails closed: an unreadable workflow folder, or a `uses:` it cannot parse, is an error.
 *
 *   node tools/build/verify-action-pins.js [--dir .github/workflows]
 *
 * Idea taken from the open-code-review study (docs/research/open-code-review-2026-09-25).
 */
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PINNED = /^[\w.-]+\/[\w.-]+(?:\/[\w./-]+)?@[0-9a-f]{40}$/;
const VERSION_COMMENT = /^#\s*v?\d+(?:\.\d+){0,2}\S*/;
const DOCKER_DIGEST = /^docker:\/\/[^@\s]+@sha256:[0-9a-f]{64}$/;

/** One problem per offending `uses:` line; an empty list means every reference is pinned. */
function checkWorkflow(text, file) {
  const problems = [];
  text.split(/\r?\n/).forEach((line, index) => {
    const match = /^\s*(?:-\s+)?uses:\s*(\S+)\s*(#.*)?$/.exec(line);
    if (!match) return;
    const [, rawRef, comment] = match;
    const ref = rawRef.replace(/^['"]|['"]$/g, '');
    const where = `${file}:${index + 1}`;
    if (ref.startsWith('./')) return;
    if (ref.startsWith('docker://')) {
      if (!DOCKER_DIGEST.test(ref))
        problems.push(`${where}: ${ref} — pin the image by sha256 digest`);
      return;
    }
    if (!PINNED.test(ref)) {
      problems.push(`${where}: ${ref} — pin to a full 40-character commit SHA`);
      return;
    }
    if (!comment || !VERSION_COMMENT.test(comment.trim())) {
      problems.push(`${where}: ${ref} — add the released version as a comment, e.g. "# v4.2.1"`);
    }
  });
  return problems;
}

function verifyDirectory(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((name) => /\.ya?ml$/.test(name))
    .sort();
  if (!files.length) throw new Error(`no workflow file in ${dir}`);
  const problems = [];
  let references = 0;
  for (const name of files) {
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    references += (text.match(/^\s*(?:-\s+)?uses:\s*\S+/gm) || []).length;
    problems.push(...checkWorkflow(text, path.join(dir, name)));
  }
  return { files: files.length, references, problems };
}

if (require.main === module) {
  const index = process.argv.indexOf('--dir');
  const dir = path.resolve(index >= 0 ? process.argv[index + 1] : '.github/workflows');
  try {
    const { files, references, problems } = verifyDirectory(dir);
    if (problems.length) {
      console.error(`Unpinned actions (${problems.length}):`);
      for (const problem of problems) console.error(`  - ${problem}`);
      process.exit(1);
    }
    console.log(`OK — ${references} uses: references in ${files} workflows are pinned or local.`);
  } catch (error) {
    console.error(`verify-action-pins: ${error.message}`);
    process.exit(1);
  }
}

module.exports = { checkWorkflow, verifyDirectory };
