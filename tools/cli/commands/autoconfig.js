/**
 * BMAD+ Autoconfig Command
 * Smart project bootstrap — analyzes existing projects or guides new ones.
 * Auto-detects stack, selects best packs, installs, populates memory.
 *
 * Author: Laurent Rochetta
 */

const path = require('node:path');
const fs = require('node:fs');
const clack = require('@clack/prompts');
const pc = require('picocolors');
const { detectStack } = require('../lib/stack-detect');
const { IDE_CONFIGS } = require('../lib/ide-config');

// ── Project Analysis Engine ──

function analyzeStructure(dir) {
  const structure = {
    hasSrc: false,
    hasTests: false,
    hasDocs: false,
    hasCI: false,
    hasDocker: false,
    hasConfig: false,
    hasLicense: false,
    hasReadme: false,
    hasGit: false,
    hasEnv: false,
    hasBmad: false,
    hasIdeConfigs: [],
    fileCount: 0,
    directories: [],
  };

  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const name = entry.name.toLowerCase();
        if (name === 'src' || name === 'lib' || name === 'app') structure.hasSrc = true;
        if (name === 'tests' || name === 'test' || name === '__tests__' || name === 'spec')
          structure.hasTests = true;
        if (name === 'docs' || name === 'doc' || name === 'documentation') structure.hasDocs = true;
        if (name === '.github' || name === '.gitlab-ci' || name === '.circleci')
          structure.hasCI = true;
        if (name === '.agents' || name === '_bmad') structure.hasBmad = true;
        if (!name.startsWith('.') && name !== 'node_modules')
          structure.directories.push(entry.name);
      } else {
        structure.fileCount++;
        const name = entry.name;
        if (
          name === 'Dockerfile' ||
          name === 'docker-compose.yml' ||
          name === 'docker-compose.yaml'
        )
          structure.hasDocker = true;
        if (name === 'LICENSE' || name === 'LICENSE.md') structure.hasLicense = true;
        if (name === 'README.md' || name === 'readme.md') structure.hasReadme = true;
        if (name === '.env' || name === '.env.local') structure.hasEnv = true;
        if (name === '.gitignore') structure.hasGit = true;
        if (name === 'CLAUDE.md') structure.hasIdeConfigs.push('claude-code');
        if (name === 'GEMINI.md') structure.hasIdeConfigs.push('gemini-cli');
        if (name === 'AGENTS.md') structure.hasIdeConfigs.push('codex-cli');
      }
    }

    // Check for .git directory
    if (fs.existsSync(path.join(dir, '.git'))) structure.hasGit = true;
  } catch (e) {
    console.warn('autoconfig: Failed to analyze directory structure', e.message);
  }

  return structure;
}

function calculateHealth(structure) {
  const checks = [
    { name: 'Source code', pass: structure.hasSrc, weight: 2 },
    { name: 'Tests', pass: structure.hasTests, weight: 2 },
    { name: 'Documentation', pass: structure.hasDocs, weight: 1 },
    { name: 'CI/CD', pass: structure.hasCI, weight: 1 },
    { name: 'Git', pass: structure.hasGit, weight: 1 },
    { name: 'README', pass: structure.hasReadme, weight: 1 },
    { name: 'License', pass: structure.hasLicense, weight: 1 },
    { name: 'Docker', pass: structure.hasDocker, weight: 1 },
  ];

  const totalWeight = checks.reduce((sum, c) => sum + c.weight, 0);
  const score = checks.reduce((sum, c) => sum + (c.pass ? c.weight : 0), 0);
  const pct = Math.round((score / totalWeight) * 100);

  return { pct, checks };
}

// `health` is measured elsewhere and does not change the recommendation: a project
// with failing checks needs the same packs as a healthy one.
function recommendPacks(stack, structure) {
  const packs = ['core', 'memory']; // Always
  const reasons = {
    core: 'Essential multi-role agents (Atlas, Forge, Sentinel, Nexus)',
    memory: 'Persistent brain for context continuity across sessions',
  };

  // Dev Studio — if no docs or complex project
  if (!structure.hasDocs || structure.directories.length > 5) {
    packs.push('dev-studio');
    reasons['dev-studio'] = !structure.hasDocs
      ? 'No docs/ found — Huldah (Tech Writer) will help document'
      : 'Complex project — full SDLC pipeline recommended';
  }

  // Shield — if CI/CD exists or Docker
  if (structure.hasCI || structure.hasDocker) {
    packs.push('shield');
    reasons.shield = 'CI/CD and/or Docker detected — GRC compliance agents recommended';
  }

  // SEO — if it looks like a web project
  if (
    stack.framework &&
    ['Next.js', 'Nuxt', 'Angular', 'React', 'Vue.js', 'Svelte'].includes(stack.framework)
  ) {
    packs.push('seo');
    reasons.seo = `${stack.framework} web app detected — SEO audit agents recommended`;
  }

  return { packs, reasons };
}

function generateRecommendations(stack, structure, health) {
  const recs = [];

  if (!structure.hasTests) {
    recs.push({
      agent: 'Sentinel',
      action: 'set up a test framework and write initial tests',
      priority: 'high',
    });
  }
  if (!structure.hasDocs) {
    recs.push({
      agent: 'Forge',
      action: 'document the project architecture and API',
      priority: 'medium',
    });
  }
  if (!structure.hasCI) {
    recs.push({ agent: 'Forge', action: 'set up CI/CD pipeline', priority: 'medium' });
  }
  if (health.pct < 60) {
    recs.push({
      agent: 'Sentinel',
      action: 'review code quality and project health',
      priority: 'high',
    });
  }

  // Context-specific
  if (structure.hasSrc) {
    recs.push({
      agent: 'Forge',
      action: 'continue developing the current module',
      priority: 'normal',
    });
  }

  // Memory
  recs.push({ agent: 'Zecher', action: 'consolidate session memory', priority: 'normal' });

  return recs;
}

function getProjectName(dir) {
  try {
    const pkgPath = path.join(dir, 'package.json');
    if (fs.existsSync(pkgPath)) {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      if (pkg.name) return pkg.name;
    }
  } catch (e) {
    console.warn('autoconfig: Failed to read package.json in getProjectName', e.message);
  }
  return path.basename(dir);
}

// ── New Project Wizard ──

async function newProjectWizard() {
  const projectType = await clack.select({
    message: 'What type of project?',
    options: [
      { value: 'web', label: '🌐 Web Application', hint: 'SPA, SSR, static site' },
      { value: 'api', label: '⚡ API / Backend', hint: 'REST, GraphQL, microservices' },
      { value: 'cli', label: '💻 CLI Tool', hint: 'command-line application' },
      { value: 'mobile', label: '📱 Mobile App', hint: 'React Native, Flutter' },
      { value: 'library', label: '📦 Library / Package', hint: 'npm, PyPI, crate' },
      { value: 'other', label: '🔧 Other', hint: 'custom project' },
    ],
  });

  if (clack.isCancel(projectType)) return null;

  const description = await clack.text({
    message: 'Describe your project in one sentence:',
    placeholder: 'A billing SaaS for freelancers with Stripe integration',
  });

  if (clack.isCancel(description)) return null;

  return { type: projectType, description };
}

// ── Main Action ──

module.exports = {
  command: 'autoconfig',
  description: 'Smart project bootstrap — auto-detect, install, and configure',
  options: [
    ['-d, --directory <path>', 'Project directory (default: current directory)'],
    ['-l, --lang <code>', 'Language code: en, fr, es, de, pt-br, ru, zh, he, ja, it'],
    ['-y, --yes', 'Accept all recommendations without prompting'],
  ],
  action: async (options) => {
    const projectDir = path.resolve(options.directory || process.cwd());

    clack.intro(pc.bgCyan(pc.black(' 🧠 BMAD+ Autoconfig ')));

    // Check if directory has content
    let entries = [];
    try {
      entries = fs.readdirSync(projectDir).filter((e) => !e.startsWith('.'));
    } catch (e) {
      console.warn('autoconfig: Failed to list directory', e.message);
    }

    const isExistingProject = entries.length > 0;

    if (isExistingProject) {
      // ── MODE A: Existing Project ──
      clack.log.info(pc.bold(`📂 Existing project detected: ${getProjectName(projectDir)}`));

      const spinner = clack.spinner();
      spinner.start('Analyzing project...');

      const stack = detectStack(projectDir);
      const structure = analyzeStructure(projectDir);
      const health = calculateHealth(structure);
      const { packs, reasons } = recommendPacks(stack, structure);
      const recs = generateRecommendations(stack, structure, health);

      spinner.stop('Analysis complete');

      // Display analysis
      clack.log.info('');
      clack.log.info(pc.bold('📊 Project Analysis'));
      clack.log.info('');

      // Stack
      const stackLabel =
        [stack.framework, stack.language, stack.runtime].filter(Boolean).join(' + ') || 'Unknown';
      clack.log.info(
        `  Stack:       ${pc.cyan(stackLabel)}${stack.packageManager ? pc.dim(` (${stack.packageManager})`) : ''}`
      );

      // Structure
      const structItems = [];
      if (structure.hasSrc) structItems.push(pc.green('src/'));
      if (structure.hasTests) structItems.push(pc.green('tests/'));
      if (structure.hasDocs) structItems.push(pc.green('docs/'));
      if (structure.hasCI) structItems.push(pc.green('CI/CD'));
      if (structure.hasDocker) structItems.push(pc.green('Docker'));
      if (!structure.hasTests) structItems.push(pc.red('no tests'));
      if (!structure.hasDocs) structItems.push(pc.red('no docs'));
      clack.log.info(`  Structure:   ${structItems.join('  ')}`);

      // Health
      const healthColor = health.pct >= 80 ? pc.green : health.pct >= 50 ? pc.yellow : pc.red;
      const healthBar =
        '█'.repeat(Math.round(health.pct / 10)) + '░'.repeat(10 - Math.round(health.pct / 10));
      clack.log.info(`  Health:      ${healthColor(`${healthBar} ${health.pct}%`)}`);

      // Existing BMAD+
      if (structure.hasBmad) {
        clack.log.info(`  BMAD+:       ${pc.green('✓ already installed')} — will update`);
      }
      if (structure.hasIdeConfigs.length > 0) {
        clack.log.info(
          `  IDE configs: ${pc.green('✓')} ${structure.hasIdeConfigs.length} found — will preserve`
        );
      }

      clack.log.info('');

      // Pack recommendations
      clack.log.info(pc.bold('📦 Recommended Packs'));
      clack.log.info('');
      for (const packId of packs) {
        clack.log.info(
          `  ${pc.green('✓')} ${pc.bold(packId.padEnd(12))} ${pc.dim(reasons[packId])}`
        );
      }
      clack.log.info('');

      // Confirm
      if (!options.yes) {
        const answer = await clack.confirm({
          message: `Install ${packs.length} recommended packs?`,
          initialValue: true,
        });
        if (clack.isCancel(answer) || !answer) {
          clack.cancel('Autoconfig cancelled.');
          return;
        }
      }

      // Run install
      const spinner2 = clack.spinner();
      spinner2.start('Installing...');

      // Use the install module directly
      const installModule = require('./install');

      // NODE-06: only generate IDE configs for IDEs this project actually uses.
      // - If IDE config files already exist, preserve them ('none').
      // - Otherwise detect IDE markers and pass only those; never let install's
      //   --yes fallback write ALL three configs into a project that uses none.
      let toolsArg;
      if (structure.hasIdeConfigs.length > 0) {
        toolsArg = 'none';
      } else {
        const detectedIDEs = [];
        for (const [id, ide] of Object.entries(IDE_CONFIGS)) {
          if (ide.detect.some((marker) => fs.existsSync(path.join(projectDir, marker)))) {
            detectedIDEs.push(id);
          }
        }
        toolsArg = detectedIDEs.length > 0 ? detectedIDEs.join(',') : 'none';
      }

      // Build install args
      try {
        await installModule.action({
          directory: projectDir,
          packs: packs.join(','),
          yes: true,
          tools: toolsArg,
          lang: options.lang,
        });
      } catch (e) {
        clack.log.error(`Autoconfig install failed: ${e.message}`);
        throw e;
      }

      spinner2.stop('Installation complete');

      // Update memory context.md
      const contextPath = path.join(projectDir, '.agents', 'memory', 'context.md');
      if (fs.existsSync(path.dirname(contextPath))) {
        const contextContent = [
          '---',
          'title: Project Context',
          `last_updated: "${new Date().toISOString().slice(0, 10)}"`,
          `auto_generated: true`,
          '---',
          '',
          '# Project Context',
          '',
          `> Auto-generated by \`npx bmad-plus autoconfig\` — ${new Date().toISOString().slice(0, 10)}`,
          '',
          '## Stack',
          '',
          `- **Language:** ${stack.language || 'Unknown'}`,
          `- **Framework:** ${stack.framework || 'None'}`,
          `- **Runtime:** ${stack.runtime || 'Unknown'}`,
          `- **Package Manager:** ${stack.packageManager || 'N/A'}`,
          `- **TypeScript:** ${stack.hasTypeScript ? 'Yes' : 'No'}`,
          '',
          '## Structure',
          '',
          `- **Source code:** ${structure.hasSrc ? 'Yes' : 'No'}`,
          `- **Tests:** ${structure.hasTests ? 'Yes' : 'No — needs setup'}`,
          `- **Documentation:** ${structure.hasDocs ? 'Yes' : 'No — needs writing'}`,
          `- **CI/CD:** ${structure.hasCI ? 'Yes' : 'No'}`,
          `- **Docker:** ${structure.hasDocker ? 'Yes' : 'No'}`,
          `- **Git:** ${structure.hasGit ? 'Yes' : 'No'}`,
          '',
          '## Health',
          '',
          `- **Score:** ${health.pct}%`,
          ...health.checks.map((c) => `- ${c.pass ? '✅' : '❌'} ${c.name}`),
          '',
          '## Key Directories',
          '',
          ...structure.directories.slice(0, 15).map((d) => `- \`${d}/\``),
          '',
          '## Installed Packs',
          '',
          ...packs.map((p) => `- ${p}`),
          '',
        ];

        fs.writeFileSync(contextPath, contextContent.join('\n'), 'utf8');
      }

      // Display recommendations
      clack.log.info('');
      clack.log.info(pc.bold('🎯 Recommended Next Steps'));
      clack.log.info('');

      const priorityIcon = { high: pc.red('‼'), medium: pc.yellow('!'), normal: pc.dim('·') };
      for (const rec of recs.slice(0, 5)) {
        clack.log.info(
          `  ${priorityIcon[rec.priority] || '·'}  "${pc.cyan(rec.agent)}, ${rec.action}"`
        );
      }

      clack.log.info('');
    } else {
      // ── MODE B: New Project ──
      clack.log.info(pc.bold('🆕 Empty directory — starting new project wizard'));
      clack.log.info('');

      const wizard = await newProjectWizard();
      if (!wizard) {
        clack.cancel('Autoconfig cancelled.');
        return;
      }

      // Select packs based on project type
      const typePacks = {
        web: ['core', 'memory', 'dev-studio', 'seo'],
        api: ['core', 'memory', 'dev-studio', 'shield'],
        cli: ['core', 'memory'],
        mobile: ['core', 'memory', 'dev-studio'],
        library: ['core', 'memory', 'dev-studio'],
        other: ['core', 'memory'],
      };

      const packs = typePacks[wizard.type] || ['core', 'memory'];

      clack.log.info(`📦 Packs for ${wizard.type} project: ${packs.join(', ')}`);

      // Run install
      try {
        const installModule = require('./install');
        await installModule.action({
          directory: projectDir,
          packs: packs.join(','),
          yes: true,
          lang: options.lang,
        });
      } catch (e) {
        clack.log.error(`Autoconfig install failed: ${e.message}`);
        throw e;
      }

      // Write initial context
      const contextPath = path.join(projectDir, '.agents', 'memory', 'context.md');
      if (fs.existsSync(path.dirname(contextPath))) {
        const contextContent = [
          '---',
          'title: Project Context',
          `last_updated: "${new Date().toISOString().slice(0, 10)}"`,
          `auto_generated: true`,
          '---',
          '',
          '# Project Context',
          '',
          `> Auto-generated by \`npx bmad-plus autoconfig\` — ${new Date().toISOString().slice(0, 10)}`,
          '',
          '## Project Brief',
          '',
          `- **Type:** ${wizard.type}`,
          `- **Description:** ${wizard.description}`,
          `- **Status:** New — not started`,
          '',
          '## Installed Packs',
          '',
          ...packs.map((p) => `- ${p}`),
          '',
        ];

        fs.writeFileSync(contextPath, contextContent.join('\n'), 'utf8');
      }

      // Recommendations for new project
      clack.log.info('');
      clack.log.info(pc.bold('🎯 Recommended First Steps'));
      clack.log.info('');
      clack.log.info(`  1. "${pc.cyan('Atlas')}, I want to build: ${wizard.description}"`);
      clack.log.info(`  2. "${pc.cyan('Atlas')}, create the PRD"`);
      clack.log.info(`  3. "${pc.cyan('Forge')}, propose the architecture"`);
      clack.log.info(`  4. Or: "${pc.cyan('autopilot')}" to let Nexus manage everything`);
      clack.log.info('');
    }

    clack.outro(pc.green('Autoconfig complete! 🚀'));
  },
  // Exported for functional testing (not part of the public API)
  _internal: {
    detectStack,
    analyzeStructure,
    calculateHealth,
    recommendPacks,
    generateRecommendations,
    getProjectName,
    newProjectWizard,
  },
};
