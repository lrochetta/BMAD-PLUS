'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');

const DIRECTORY = '.bmad/memory';
const LOCK = DIRECTORY + '/writer.lock';
const MAX_BYTES = 2 * 1024 * 1024;
const held = new Set();

function safeFile(baseDir, relative) {
  const root = path.resolve(baseDir);
  if (
    typeof relative !== 'string' ||
    !relative ||
    relative.includes(':') ||
    path.isAbsolute(relative) ||
    relative.split(/[\\/]/).some((p) => !p || p === '..' || p === '.')
  ) {
    throw new Error('Memory path must be a normalized project-relative path.');
  }
  const target = path.resolve(root, relative);
  if (!target.startsWith(root + path.sep)) throw new Error('Memory path escapes project.');
  let current = path.parse(target).root;
  for (const part of target.slice(current.length).split(path.sep)) {
    current = path.join(current, part);
    let stat;
    try {
      stat = fs.lstatSync(current);
    } catch (error) {
      if (error.code === 'ENOENT') continue;
      throw error;
    }
    if (stat.isSymbolicLink())
      throw new Error('Memory paths cannot follow symbolic links or junctions.');
    if (current !== target && !stat.isDirectory())
      throw new Error('Memory parent is not a directory.');
  }
  return target;
}

function readText(baseDir, relative, { missing = false } = {}) {
  const file = safeFile(baseDir, relative);
  let stat;
  try {
    stat = fs.statSync(file);
  } catch (error) {
    if (missing && error.code === 'ENOENT') return null;
    throw error;
  }
  if (!stat.isFile() || stat.size > MAX_BYTES)
    throw new Error('Memory source must be a regular file of at most 2 MiB.');
  const buffer = fs.readFileSync(file);
  if (buffer.length > MAX_BYTES) throw new Error('Memory source exceeded 2 MiB while reading.');
  const text = buffer.toString('utf8');
  if (!Buffer.from(text).equals(buffer)) throw new Error('Memory source must contain valid UTF-8.');
  return text;
}

/** Synchronous, process-shared mutex; stale owners require explicit operator inspection. */
function withMemoryLock(baseDir, operation) {
  const root = path.resolve(baseDir);
  if (held.has(root)) return operation(); // Nested synchronous legacy score/promotion writes.
  const file = safeFile(root, LOCK);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const owner = JSON.stringify({
    pid: process.pid,
    hostname: os.hostname(),
    token: crypto.randomUUID(),
  });
  let descriptor;
  for (let attempt = 0; attempt < 200; attempt++) {
    try {
      descriptor = fs.openSync(safeFile(root, LOCK), 'wx');
      break;
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 10);
    }
  }
  if (descriptor === undefined)
    throw new Error(
      'Memory writer lock is occupied. Inspect writer.lock and its owner; do not remove a live lock.'
    );
  try {
    fs.writeFileSync(descriptor, owner);
    fs.fsyncSync(descriptor);
    held.add(root);
    const result = operation();
    if (result && typeof result.then === 'function')
      throw new Error('Memory lock operations must be synchronous.');
    return result;
  } finally {
    held.delete(root);
    fs.closeSync(descriptor);
    if (readText(root, LOCK, { missing: true }) === owner) fs.unlinkSync(safeFile(root, LOCK));
  }
}

function appendRecord(baseDir, relative, record) {
  return withMemoryLock(baseDir, () => {
    const file = safeFile(baseDir, relative);
    const prior = readText(baseDir, relative, { missing: true }) || '';
    const line = JSON.stringify(record) + '\n';
    if (Buffer.byteLength(prior + line) > MAX_BYTES)
      throw new Error('Memory store is full; archive it explicitly before adding records.');
    if (prior && !prior.endsWith('\n'))
      throw new Error('Memory store has an incomplete final line; inspect it before writing.');
    const descriptor = fs.openSync(file, 'a');
    try {
      fs.writeFileSync(descriptor, line);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    return record;
  });
}

function writeJson(baseDir, relative, value) {
  return withMemoryLock(baseDir, () => {
    const file = safeFile(baseDir, relative);
    const text = JSON.stringify(value, null, 2) + '\n';
    if (Buffer.byteLength(text) > MAX_BYTES) throw new Error('Memory store exceeds 2 MiB.');
    const temporary = safeFile(baseDir, relative + '.' + crypto.randomUUID() + '.tmp');
    const descriptor = fs.openSync(temporary, 'wx');
    try {
      fs.writeFileSync(descriptor, text);
      fs.fsyncSync(descriptor);
    } finally {
      fs.closeSync(descriptor);
    }
    fs.renameSync(temporary, file);
  });
}

module.exports = { withMemoryLock, appendRecord, writeJson, readText, safeFile, LOCK, MAX_BYTES };
