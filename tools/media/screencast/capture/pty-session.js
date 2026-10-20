/**
 * Drive an interactive command through a real pseudo-terminal and record what it prints.
 *
 * `script(1)` allocates the pty. Keys are sent one after another: each step may wait for text to
 * appear in the output (so a slow machine never sends a key before the prompt is ready) and then
 * pause for a human-like delay. The result is the list of output chunks with their arrival
 * time, which lib/vt.js later turns into screens. Runs inside the capture container only.
 */
'use strict';

const { spawn } = require('node:child_process');

const KEYS = {
  enter: '\r',
  down: '\u001b[B',
  up: '\u001b[A',
  space: ' ',
  ctrlc: '\u0003',
};

// eslint-disable-next-line no-control-regex
const ANSI = /\u001b\[[0-9;?]*[ -/]*[@-~]/g;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * @param {string} command shell command to run inside the pty
 * @param {Array<{until?:string,delay?:number,key?:string,text?:string}>} script steps in order
 * @param {{cols?:number,rows?:number,cwd?:string,env?:object,timeoutMs?:number}} options
 * @returns {Promise<{chunks:Array<{t:number,data:string}>,exitCode:number,cols:number,rows:number}>}
 */
function runInPty(command, script, options = {}) {
  const cols = options.cols || 80;
  const rows = options.rows || 30;
  const started = Date.now();
  const chunks = [];
  let output = '';
  const child = spawn(
    'script',
    ['-qfec', `stty cols ${cols} rows ${rows}; ${command}`, '/dev/null'],
    {
      cwd: options.cwd,
      env: { ...process.env, ...options.env, TERM: 'xterm-256color' },
    }
  );
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (data) => {
    chunks.push({ t: (Date.now() - started) / 1000, data });
    output += data;
  });

  const timeoutMs = options.timeoutMs || 90000;
  const driver = (async () => {
    let since = 0;
    for (const step of script) {
      if (step.until) {
        const limit = Date.now() + timeoutMs;
        while (!output.slice(since).replace(ANSI, '').includes(step.until)) {
          if (Date.now() > limit)
            throw new Error(`pty: "${step.until}" never appeared for: ${command}`);
          await sleep(20);
        }
      }
      await sleep((step.delay || 0) * 1000);
      if (!child.stdin.destroyed) child.stdin.write(step.text ?? KEYS[step.key]);
      since = output.length;
    }
  })();

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`pty command timed out: ${command}`));
    }, timeoutMs + 20000);
    driver.catch((error) => {
      child.kill('SIGKILL');
      clearTimeout(timer);
      reject(error);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ chunks, exitCode: code, cols, rows });
    });
  });
}

module.exports = { runInPty, KEYS };
