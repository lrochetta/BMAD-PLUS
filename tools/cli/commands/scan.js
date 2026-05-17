/**
 * BMAD+ Scan Command
 * Scan directories to discover projects, detect stacks, and index them in the global brain.
 * Interactive validation — user confirms each project before indexing.
 *
 * Author: Laurent Rochetta
 */

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const crypto = require('node:crypto');
const clack = require('@clack/prompts');
const pc = require('picocolors');

// Project detection markers (priority order)
const PROJECT_MARKERS = [
  { file: 'package.json', stack: 'Node.js', detect: (dir) => {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps['next']) return 'Next.js';
      if (deps['nuxt']) return 'Nuxt';
      if (deps['react']) return 'React';
      if (deps['vue']) return 'Vue.js';
      if (deps['svelte']) return 'Svelte';
      if (deps['express']) return 'Express';
      if (deps['fastify']) return 'Fastify';
      if (deps['electron']) return 'Electron';
      if (deps['tauri']) return 'Tauri';
      return 'Node.js';
    } catch { return 'Node.js'; }
  }},
  { file: 'Cargo.toml', stack: 'Rust' },
  { file: 'pyproject.toml', stack: 'Python' },
  { file: 'requirements.txt', stack: 'Python' },
  { file: 'go.mod', stack: 'Go' },
  { file: 'composer.json', stack: 'PHP' },
  { file: 'Gemfile', stack: 'Ruby' },
  { file: 'pom.xml', stack: 'Java' },
  { file: 'build.gradle', stack: 'Java/Kotlin' },
];

// Directories to skip during scanning
const SKIP_DIRS = new Set([
  'node_modules', '.git', 'vendor', '__pycache__', 'dist', 'build',
  '.next', '.nuxt', '.svelte-kit', 'target', '.venv', 'venv',
  '.cache', '.output', 'coverage', '.turbo', '.angular',
  '$RECYCLE.BIN', 'System Volume Information', 'Windows',
  'Program Files', 'Program Files (x86)', 'ProgramData',
  'AppData', 'Recovery', 'PerfLogs',
]);

function getProjectStatus(dir, activeDays = 30, pausedDays = 180) {
  try {
    const stat = fs.statSync(dir);
    const daysSince = (Date.now() - stat.mtimeMs) / (1000 * 60 * 60 * 24);
    if (daysSince < activeDays) return 'active';
    if (daysSince < pausedDays) return 'paused';
    return 'archived';
  } catch { return 'unknown'; }
}

function getStatusIcon(status) {
  switch (status) {
    case 'active': return pc.green('●');
    case 'paused': return pc.yellow('◐');
    case 'archived': return pc.dim('○');
    default: return pc.dim('?');
  }
}

function getProjectName(dir) {
  try {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) return pkg.name;
    }
  } catch {}
  return path.basename(dir);
}

function hasBmadInstalled(dir) {
  return fs.existsSync(path.join(dir, '.agents')) ||
         fs.existsSync(path.join(dir, '_bmad'));
}

function scanDirectory(rootDir, maxDepth = 4, currentDepth = 0, activeDays = 30, pausedDays = 180) {
  const projects = [];

  if (currentDepth > maxDepth) return projects;

  let entries;
  try {
    entries = fs.readdirSync(rootDir, { withFileTypes: true });
  } catch {
    return projects; // Permission denied or inaccessible
  }

  // Check if current dir is a project
  for (const marker of PROJECT_MARKERS) {
    if (fs.existsSync(path.join(rootDir, marker.file))) {
      const stack = marker.detect ? marker.detect(rootDir) : marker.stack;
      projects.push({
        path: rootDir,
        name: getProjectName(rootDir),
        stack,
        status: getProjectStatus(rootDir, activeDays, pausedDays),
        bmad: hasBmadInstalled(rootDir),
        hasAgentsMd: fs.existsSync(path.join(rootDir, 'AGENTS.md')),
        hasGit: fs.existsSync(path.join(rootDir, '.git')),
      });
      return projects; // Don't recurse into project subdirs
    }
  }

  // Also detect by .git alone (any project with version control)
  if (fs.existsSync(path.join(rootDir, '.git')) && currentDepth > 0) {
    projects.push({
      path: rootDir,
      name: getProjectName(rootDir),
      stack: 'Unknown',
      status: getProjectStatus(rootDir, activeDays, pausedDays),
      bmad: hasBmadInstalled(rootDir),
      hasAgentsMd: fs.existsSync(path.join(rootDir, 'AGENTS.md')),
      hasGit: true,
    });
    return projects;
  }

  // Recurse into subdirectories
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (SKIP_DIRS.has(entry.name)) continue;
    if (entry.name.startsWith('.') && entry.name !== '.git') continue;

    const subPath = path.join(rootDir, entry.name);
    const subProjects = scanDirectory(subPath, maxDepth, currentDepth + 1, activeDays, pausedDays);
    projects.push(...subProjects);
  }

  return projects;
}

module.exports = {
  command: 'scan',
  description: 'Scan directories to discover and index projects in the global brain',
  options: [
    ['-d, --directory <path>', 'Directory to scan (default: current directory)'],
    ['--depth <n>', 'Max depth to scan (default: 4)', '4'],
    ['--active-days <n>', 'Days since last modified to consider a project "active" (default: 30)', '30'],
    ['--paused-days <n>', 'Days since last modified to consider a project "paused" (default: 180)', '180'],
    ['-y, --yes', 'Index all projects without prompting'],
  ],
  action: async (options) => {
    const scanDir = path.resolve(options.directory || process.cwd());
    const maxDepth = parseInt(options.depth) || 4;
    const activeDays = parseInt(options.activeDays) || 30;
    const pausedDays = parseInt(options.pausedDays) || 180;

    clack.intro(pc.bgMagenta(pc.white(' 🧠 BMAD+ Project Scanner ')));

    // Verify directory exists
    if (!fs.existsSync(scanDir)) {
      clack.log.error(`Directory not found: ${scanDir}`);
      clack.outro(pc.red('Scan failed.'));
      return;
    }

    // Scan
    const spinner = clack.spinner();
    spinner.start(`Scanning ${scanDir} (depth: ${maxDepth})...`);

    const projects = scanDirectory(scanDir, maxDepth, 0, activeDays, pausedDays);

    if (projects.length === 0) {
      spinner.stop('No projects found.');
      clack.outro('Try scanning a different directory or increasing --depth');
      return;
    }

    spinner.stop(`Found ${pc.bold(projects.length)} project(s)`);

    // Display legend
    const activeCount = projects.filter(p => p.status === 'active').length;
    const pausedCount = projects.filter(p => p.status === 'paused').length;
    const archivedCount = projects.filter(p => p.status === 'archived').length;

    clack.log.info('');
    clack.log.info(pc.dim('  Legend:'));
    clack.log.info(`    ${pc.green('●')} active    modified < ${activeDays} days ago     ${pc.dim(`(${activeCount} found)`)}`);
    clack.log.info(`    ${pc.yellow('◐')} paused    modified ${activeDays}–${pausedDays} days ago   ${pc.dim(`(${pausedCount} found)`)}`);
    clack.log.info(`    ${pc.dim('○')} archived  modified > ${pausedDays} days ago    ${pc.dim(`(${archivedCount} found)`)}`);
    clack.log.info('');

    // Display table
    clack.log.info(pc.bold('  #   Status    BMAD+  Stack             Name                  Path'));
    clack.log.info(pc.dim('  ' + '─'.repeat(90)));

    projects.forEach((p, i) => {
      const num = String(i + 1).padStart(3);
      const status = getStatusIcon(p.status) + ' ' + p.status.padEnd(8);
      const bmad = p.bmad ? pc.green('✓') : pc.dim('·');
      const stack = p.stack.padEnd(16);
      const name = p.name.substring(0, 20).padEnd(20);
      const projPath = p.path.length > 40 ? '...' + p.path.slice(-37) : p.path;
      clack.log.info(`  ${num}  ${status}  ${bmad}      ${stack}  ${name}  ${pc.dim(projPath)}`);
    });

    clack.log.info('');

    // Interactive validation
    const globalBrainDir = path.join(os.homedir(), '.bmad-plus', 'brain', 'projects');

    if (options.yes) {
      // Auto-index all
      const fsExtra = require('fs-extra');
      fsExtra.ensureDirSync(globalBrainDir);

      let indexed = 0;
      for (const proj of projects) {
        const hash = crypto.createHash('sha256').update(proj.path).digest('hex').slice(0, 8);
        const meta = {
          path: proj.path,
          name: proj.name,
          hash,
          stack: proj.stack,
          status: proj.status,
          bmad_installed: proj.bmad,
          has_git: proj.hasGit,
          last_scanned: new Date().toISOString().slice(0, 10),
        };
        fs.writeFileSync(
          path.join(globalBrainDir, `${hash}.yaml`),
          Object.entries(meta).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n'),
          'utf8'
        );
        indexed++;
      }
      clack.log.success(`✅ ${indexed} project(s) indexed in ${globalBrainDir}`);
    } else {
      // Interactive mode
      const action = await clack.select({
        message: `${projects.length} project(s) found. What to do?`,
        options: [
          { value: 'all', label: `✅ Index all ${projects.length} projects` },
          { value: 'select', label: '✏️  Select which to index' },
          { value: 'none', label: '⏭️  Skip — don\'t index anything' },
        ],
      });

      if (clack.isCancel(action) || action === 'none') {
        clack.cancel('Scan cancelled.');
        return;
      }

      const fsExtra = require('fs-extra');
      fsExtra.ensureDirSync(globalBrainDir);

      let toIndex = projects;

      if (action === 'select') {
        const selected = await clack.multiselect({
          message: 'Select projects to index:',
          options: projects.map((p, i) => ({
            value: i,
            label: `${p.name} (${p.stack})`,
            hint: `${p.status} — ${p.path}`,
          })),
          required: false,
        });

        if (clack.isCancel(selected)) {
          clack.cancel('Scan cancelled.');
          return;
        }

        toIndex = selected.map(i => projects[i]);
      }

      let indexed = 0;
      for (const proj of toIndex) {
        const hash = crypto.createHash('sha256').update(proj.path).digest('hex').slice(0, 8);
        const meta = {
          path: proj.path,
          name: proj.name,
          hash,
          stack: proj.stack,
          status: proj.status,
          bmad_installed: proj.bmad,
          has_git: proj.hasGit,
          last_scanned: new Date().toISOString().slice(0, 10),
        };
        fs.writeFileSync(
          path.join(globalBrainDir, `${hash}.yaml`),
          Object.entries(meta).map(([k, v]) => `${k}: ${JSON.stringify(v)}`).join('\n'),
          'utf8'
        );
        indexed++;
      }

      clack.log.success(`✅ ${indexed} project(s) indexed in global brain`);
    }

    // Generate human-readable index
    const indexPath = path.join(os.homedir(), '.bmad-plus', 'brain', 'projects-index.md');
    const existingProjects = [];
    if (fs.existsSync(globalBrainDir)) {
      for (const f of fs.readdirSync(globalBrainDir)) {
        if (!f.endsWith('.yaml')) continue;
        try {
          const content = fs.readFileSync(path.join(globalBrainDir, f), 'utf8');
          const meta = {};
          for (const line of content.split('\n')) {
            const m = line.match(/^(\w+):\s*(.+)$/);
            if (m) {
              try { meta[m[1]] = JSON.parse(m[2]); } catch { meta[m[1]] = m[2]; }
            }
          }
          existingProjects.push(meta);
        } catch {}
      }
    }

    const indexContent = [
      '---',
      'title: Project Index',
      `last_updated: "${new Date().toISOString().slice(0, 10)}"`,
      `total_projects: ${existingProjects.length}`,
      '---',
      '',
      '# Project Index',
      '',
      `> Auto-generated by \`npx bmad-plus scan\` — ${new Date().toISOString().slice(0, 10)}`,
      '',
      '| Status | Name | Stack | BMAD+ | Path |',
      '|--------|------|-------|-------|------|',
      ...existingProjects.map(p =>
        `| ${p.status || '?'} | ${p.name || '?'} | ${p.stack || '?'} | ${p.bmad_installed ? '✓' : '·'} | \`${p.path || '?'}\` |`
      ),
      '',
    ];

    fs.writeFileSync(indexPath, indexContent.join('\n'), 'utf8');
    clack.log.info(`📋 Project index updated: ${indexPath}`);

    clack.outro(pc.green('Scan complete! 🧠'));
  },
};
