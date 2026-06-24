/**
 * BMAD+ Install Command
 * Installs agents, skills, and IDE configs into the current project
 * Supports 10 languages: EN, FR, ES, DE, PT-BR, RU, ZH, HE, JA, IT
 *
 * Author: Laurent Rochetta
 */

const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const fsExtra = require('fs-extra');
const clack = require('@clack/prompts');
const pc = require('picocolors');
const { t, getLanguageOptions, getCommLanguageOptions } = require('../i18n');
const { PACKS } = require('../lib/packs');
const { copyPackFiles } = require('../lib/pack-copy');
const { initMemory } = require('../lib/memory-init');

// Pack definitions are imported from the shared module: require('../lib/packs').PACKS

// IDE configurations
const IDE_CONFIGS = {
  'claude-code': {
    name: 'Claude Code',
    detect: ['.claude'],
    configFile: 'CLAUDE.md',
  },
  'gemini-cli': {
    name: 'Gemini CLI',
    detect: ['.gemini'],
    configFile: 'GEMINI.md',
  },
  'codex-cli': {
    name: 'Codex CLI / OpenCode',
    detect: ['.codex', '.opencode'],
    configFile: 'AGENTS.md',
  },
  'antigravity': {
    name: 'Antigravity',
    detect: ['.gemini/antigravity'],
    configFile: 'GEMINI.md',
  },
};

module.exports = {
  command: 'install',
  description: 'Install BMAD+ agents and skills into your project',
  options: [
    ['-d, --directory <path>', 'Installation directory (default: current directory)'],
    ['-p, --packs <packs>', 'Comma-separated pack IDs: core,osint,all (default: interactive)'],
    ['-y, --yes', 'Accept all defaults, skip prompts'],
    ['--tools <tools>', 'Comma-separated IDE IDs (default: auto-detect)'],
  ],
  action: async (options) => {
    const projectDir = path.resolve(options.directory || process.cwd());
    const bmadSrc = path.join(__dirname, '..', '..', '..', 'src', 'bmad-plus');

    // ── Step 0: Language Selection ──
    const pkgJson = require('../../../package.json');
    clack.intro(pc.bgCyan(pc.black(` BMAD+ Installer v${pkgJson.version} `)));
    clack.log.info(pc.dim('✨ Created by Laurent Rochetta — github.com/lrochetta/BMAD-PLUS'));

    let lang = 'en';
    if (!options.yes) {
      const langChoice = await clack.select({
        message: '🌐 Select your language / Choisissez votre langue / 选择语言',
        options: getLanguageOptions(),
      });

      if (clack.isCancel(langChoice)) {
        clack.cancel('Installation cancelled.');
        throw new Error('Installation cancelled.');
      }
      lang = langChoice;
    }

    const i = t(lang); // Get translations for selected language

    // Verify source exists
    if (!fs.existsSync(bmadSrc)) {
      clack.log.error(`${i.source_not_found}: ${bmadSrc}`);
      clack.outro(pc.red(i.failed));
      throw new Error(`Source not found: ${bmadSrc}`);
    }

    clack.log.info(`${i.installing_to}: ${pc.cyan(projectDir)}`);

    // ── Step 1: Pack Selection ──
    let selectedPacks = ['core']; // Core always included

    if (options.packs) {
      const requested = options.packs.split(',').map(p => p.trim());
      if (requested.includes('all')) {
        selectedPacks = Object.keys(PACKS).filter(k => !PACKS[k].disabled);
      } else {
        selectedPacks = [...new Set(['core', ...requested.filter(p => PACKS[p] && !PACKS[p].disabled)])];
      }
    } else if (!options.yes) {
      const packChoice = await clack.multiselect({
        message: i.select_packs,
        options: Object.entries(PACKS)
          .filter(([, p]) => !p.required)
          .map(([key, pack]) => ({
            value: key,
            label: `${pack.icon} ${pack.name}`,
            hint: pack.disabled ? i.soon : (pack.desc || pack.description || ''),
            disabled: pack.disabled,
          })),
        required: false,
      });

      if (clack.isCancel(packChoice)) {
        clack.cancel(i.cancelled);
        throw new Error(i.cancelled);
      }

      selectedPacks = [...new Set(['core', ...packChoice])];
    }

    clack.log.success(`${i.selected_packs}: ${selectedPacks.map(p => `${PACKS[p].icon} ${PACKS[p].name}`).join(', ')}`);

    // ── Step 2: IDE Detection ──
    let detectedIDEs = [];

    if (options.tools) {
      if (options.tools === 'none' || options.tools === 'skip') {
        detectedIDEs = [];
      } else {
        detectedIDEs = options.tools.split(',').map(t => t.trim()).filter(t => IDE_CONFIGS[t]);
      }
    } else {
      // Auto-detect
      for (const [id, ide] of Object.entries(IDE_CONFIGS)) {
        for (const marker of ide.detect) {
          if (fs.existsSync(path.join(projectDir, marker))) {
            detectedIDEs.push(id);
            break;
          }
        }
      }

      // If nothing detected, ask
      if (detectedIDEs.length === 0 && !options.yes) {
        const ideChoice = await clack.multiselect({
          message: i.select_ide,
          options: Object.entries(IDE_CONFIGS).map(([key, ide]) => ({
            value: key,
            label: ide.name,
          })),
          required: false,
        });

        if (!clack.isCancel(ideChoice)) {
          detectedIDEs = ideChoice;
        }
      }

      // Default to all if --yes
      if (detectedIDEs.length === 0 && options.yes) {
        detectedIDEs = Object.keys(IDE_CONFIGS);
      }
    }

    if (detectedIDEs.length > 0) {
      clack.log.info(`${i.detected_ides}: ${detectedIDEs.map(id => IDE_CONFIGS[id].name).join(', ')}`);
    } else if (options.tools === 'none' || options.tools === 'skip') {
      clack.log.info(pc.dim('⏭️  IDE config skipped (--tools none) — existing configs preserved'));
    }

    // ── Step 3: User Config ──
    let userName = process.env.USER || process.env.USERNAME || 'Developer';
    let commLang = 'French';

    if (!options.yes) {
      const userConfig = await clack.group({
        userName: () => clack.text({
          message: i.enter_name,
          placeholder: userName,
          defaultValue: userName,
        }),
        commLang: () => clack.select({
          message: i.comm_language,
          options: getCommLanguageOptions(),
        }),
        execMode: () => clack.select({
          message: i.exec_mode,
          options: [
            { value: 'manual', label: i.exec_manual },
            { value: 'autopilot', label: i.exec_autopilot },
            { value: 'hybrid', label: i.exec_hybrid },
          ],
        }),
      });

      if (clack.isCancel(userConfig)) {
        clack.cancel(i.cancelled);
        throw new Error(i.cancelled);
      }

      // Validate user-provided name
      const rawName = userConfig.userName;
      const SHELL_META = /[;&|`$(){}[\]!#~<>*?\\\n\r]/;
      if (!rawName || rawName.trim().length === 0) {
        clack.log.warn('Name cannot be empty. Using default.');
        userName = process.env.USER || process.env.USERNAME || 'Developer';
      } else if (rawName.length > 100) {
        clack.log.warn('Name too long (>100 chars). Truncating.');
        userName = rawName.slice(0, 100);
      } else if (SHELL_META.test(rawName)) {
        clack.log.warn('Name contains shell metacharacters. Using sanitized version.');
        userName = rawName.replace(SHELL_META, '').trim() || 'Developer';
      } else {
        userName = rawName;
      }
      commLang = userConfig.commLang;
    }

    // ── Step 4: Install Files ──
    const spinner = clack.spinner();
    spinner.start(i.installing_files);

    const targetAgentsDir = path.join(projectDir, '.agents', 'skills');
    const targetDataDir = path.join(projectDir, '.agents', 'data');
    const targetBmadDir = path.join(projectDir, '_bmad');

    // Create directories
    fsExtra.ensureDirSync(targetAgentsDir);
    fsExtra.ensureDirSync(targetDataDir);
    fsExtra.ensureDirSync(targetBmadDir);

    let copiedAgents = 0;
    let copiedSkills = 0;
    let copiedFiles = 0;

    const projectRoot = path.join(bmadSrc, '..', '..');

    for (const packId of selectedPacks) {
      const pack = PACKS[packId];
      if (!pack || pack.disabled) continue;

      const result = copyPackFiles({
        bmadSrc,
        targetAgentsDir,
        targetDataDir,
        projectRoot,
        pack,
      });
      copiedAgents += result.copiedAgents;
      copiedSkills += result.copiedSkills;
      copiedFiles += result.copiedFiles;

      // Memory pack: initialize brain with existing brain detection
      if (packId === 'memory' && pack.packDir) {
        initMemory({ projectDir, bmadSrc, userName, commLang, selectedPacks });
      }
    }

    // Copy module config
    const moduleYaml = path.join(bmadSrc, 'module.yaml');
    if (fs.existsSync(moduleYaml)) {
      fsExtra.copySync(moduleYaml, path.join(targetBmadDir, 'module.yaml'));
      copiedFiles++;
    }

    const helpCsv = path.join(bmadSrc, 'module-help.csv');
    if (fs.existsSync(helpCsv)) {
      fsExtra.copySync(helpCsv, path.join(targetBmadDir, 'module-help.csv'));
      copiedFiles++;
    }

    spinner.stop(i.installed_summary(copiedAgents, copiedSkills, copiedFiles));

    // ── Step 5: Generate IDE Configs ──
    if (detectedIDEs.length > 0) {
      const ideSpinner = clack.spinner();
      ideSpinner.start(i.configuring_ides);

      const configContent = generateIDEConfig(userName, commLang, selectedPacks);

      for (const ideId of detectedIDEs) {
        const ide = IDE_CONFIGS[ideId];
        if (!ide) continue;

        const configPath = path.join(projectDir, ide.configFile);
        fs.writeFileSync(configPath, configContent, 'utf8');
      }

      ideSpinner.stop(i.ide_configured(detectedIDEs.length));
    }

    // ── Step 6: Create config.yaml ──
    const configYaml = generateConfigYaml(userName, commLang, projectDir);
    const configPath = path.join(targetBmadDir, 'config.yaml');
    fs.writeFileSync(configPath, configYaml, 'utf8');

    // ── Step 7: Create output directories ──
    const outputDir = path.join(projectDir, '_bmad-output');
    fsExtra.ensureDirSync(path.join(outputDir, 'discovery'));
    fsExtra.ensureDirSync(path.join(outputDir, 'build'));
    fsExtra.ensureDirSync(path.join(projectDir, 'docs'));

    // ── Step 8: Write install manifest ──
    const pkgVersion = require('../../../package.json').version;
    const manifest = {
      version: pkgVersion,
      uiLanguage: lang,
      installed: new Date().toISOString(),
      packs: selectedPacks,
      ides: detectedIDEs,
      user: userName,
      language: commLang,
    };
    fs.writeFileSync(
      path.join(targetBmadDir, '.bmad-plus-install.json'),
      JSON.stringify(manifest, null, 2),
      'utf8'
    );

    // ── Summary — Contextual Getting Started ──
    const agentGuide = [
      i.guide_who,
      '',
      `  ${i.guide_idea.padEnd(28)} →  "Atlas, [...]"`,
      `  ${i.guide_prd.padEnd(28)} →  "Atlas, create PRD"`,
      `  ${i.guide_arch.padEnd(28)} →  "Forge, propose architecture"`,
      `  ${i.guide_code.padEnd(28)} →  "Forge, implement story [X]"`,
      `  ${i.guide_test.padEnd(28)} →  "Sentinel, review module [X]"`,
      `  ${i.guide_sprint.padEnd(28)} →  "Nexus, create epics"`,
      `  ${i.guide_auto.padEnd(28)} →  "autopilot"`,
    ];

    if (selectedPacks.includes('osint')) {
      agentGuide.push(`  ${i.guide_osint.padEnd(28)} →  "Shadow, investigate [name]"`);
    }

    if (selectedPacks.includes('maker')) {
      agentGuide.push(`  ${i.guide_maker.padEnd(28)} →  "Maker, create agent [desc]"`);
    }

    if (selectedPacks.includes('seo')) {
      agentGuide.push(`  ${i.guide_seo.padEnd(28)} →  "/seo audit <url>"`);
    }

    if (selectedPacks.includes('backup')) {
      agentGuide.push(`  ${i.guide_backup.padEnd(28)} →  "/backup create"`);
    }

    if (selectedPacks.includes('animated')) {
      agentGuide.push(`  ${i.guide_animated.padEnd(28)} →  "/animated build <video>"`);
    }

    if (selectedPacks.includes('shield')) {
      agentGuide.push(`  ${(i.guide_shield || '🛡️ GRC Compliance').padEnd(28)} →  "Shield, audit my SaaS for GDPR"`);
    }

    if (selectedPacks.includes('memory')) {
      agentGuide.push(`  ${(i.guide_memory || '🧠 Memory Brain').padEnd(28)} →  "Zecher, scan projects in [path]"`);
    }

    if (selectedPacks.includes('dev-studio')) {
      agentGuide.push(`  ${(i.guide_dev_studio || '🏗️ Dev Studio').padEnd(28)} →  "Miriam, brainstorm my app idea"`);
    }

    agentGuide.push(
      '',
      i.guide_workflow,
      '  1. Atlas (idea → brief → PRD)',
      '  2. Forge (architecture → code)',
      '  3. Sentinel (tests → review)',
      '',
      i.guide_or_auto,
      '',
      `${i.guide_output}: _bmad-output/discovery/ & _bmad-output/build/`,
      '',
      '─'.repeat(50),
      '',
      `📦 ${i.guide_cli_title || 'CLI Commands'}:`,
      `  npx bmad-plus install    ${i.guide_cli_install || '— Install agents & skills'}`,
      `  npx bmad-plus update     ${i.guide_cli_update || '— Update agents (keeps config)'}`,
      `  npx bmad-plus doctor     ${i.guide_cli_doctor || '— Check installation health'}`,
      `  npx bmad-plus uninstall  ${i.guide_cli_uninstall || '— Remove BMAD+ from project'}`,
    );

    // Add pack-specific examples
    const examples = [];
    if (selectedPacks.includes('seo')) {
      examples.push(`  ${i.guide_example_seo || '🔍 SEO: "/seo audit https://example.com"'}`);
    }
    if (selectedPacks.includes('backup')) {
      examples.push(`  ${i.guide_example_backup || '🗂️  Backup: "/backup create" → ZIP timestamped'}`);
    }
    if (selectedPacks.includes('animated')) {
      examples.push(`  ${i.guide_example_animated || '🎬 Animated: "/animated build hero.mp4"'}`);
    }
    if (selectedPacks.includes('osint')) {
      examples.push(`  ${i.guide_example_osint || '🔍 OSINT: "Shadow, investigate John Doe"'}`);
    }
    if (selectedPacks.includes('shield')) {
      examples.push(
        `  ${i.guide_example_shield_1 || '🛡️ GRC: "Shield, audit my app for GDPR compliance"'}`,
        `  ${i.guide_example_shield_2 || '🛡️ GRC: "Shield, gap analysis ISO 27001 vs NIST CSF"'}`,
        `  ${i.guide_example_shield_3 || '🛡️ GRC: "Shield, generate SOC 2 evidence checklist"'}`,
      );
    }
    if (selectedPacks.includes('dev-studio')) {
      examples.push(
        `  ${i.guide_example_dev_studio_1 || '🏗️ Dev Studio: "Miriam, brainstorm a productivity app"'}`,
        `  ${i.guide_example_dev_studio_2 || '🏗️ Dev Studio: "Bezalel, design the architecture"'}`,
        `  ${i.guide_example_dev_studio_3 || '🏗️ Dev Studio: "Oholiab, implement story S1"'}`,
      );
    }
    if (selectedPacks.includes('memory')) {
      examples.push(
        `  ${i.guide_example_memory_1 || '🧠 Memory: "Zecher, scan projects in D:\\travail\\DEV"'}`,
        `  ${i.guide_example_memory_2 || '🧠 Memory: "Zecher, where were we?"'}`,
        `  ${i.guide_example_memory_3 || '🧠 Memory: "Zecher, consolidate memory"'}`,
      );
    }

    if (examples.length > 0) {
      agentGuide.push(
        '',
        `💡 ${i.guide_examples_title || 'Quick Examples'}:`,
        ...examples
      );
    }

    agentGuide.push(
      '',
      '---',
      i.guide_credits
    );

    clack.note(agentGuide.join('\n'), i.guide_title);

    clack.outro(pc.green(i.guide_ready));
  },
};


// ── Helpers ──

function generateIDEConfig(userName, language, packs) {
  const agents = [
    '- **Atlas** (Strategist) — Business analysis + Product management',
    '- **Forge** (Architect-Dev) — Architecture + Development + Documentation',
    '- **Sentinel** (Quality) — QA + UX review',
    '- **Nexus** (Orchestrator) — Sprint management + Autopilot + Parallel execution',
  ];

  if (packs.includes('osint')) {
    agents.push('- **Shadow** (OSINT) — Investigation + Scraping + Psychoprofiling');
  }

  if (packs.includes('shield')) {
    agents.push('- **Shield** (GRC) — 38 compliance agents (GDPR, ISO 27001, SOC 2, HIPAA, EU AI Act, DORA, NIS2...)');
  }

  if (packs.includes('dev-studio')) {
    agents.push('- **Miriam** (מרים) — Business Analyst — Strategic analysis, research, product briefs');
    agents.push('- **Huldah** (חולדה) — Technical Writer — Documentation, diagrams, editorial review');
    agents.push('- **Yosef** (יוסף) — Product Manager — PRD, requirements, feature prioritization');
    agents.push('- **Rachel** (רחל) — UX Designer — User experience, wireframes, empathy mapping');
    agents.push('- **Bezalel** (בצלאל) — System Architect — Architecture, ADRs, epics & stories');
    agents.push('- **Oholiab** (אהליאב) — Senior Engineer — TDD, sprint, code review, implementation');
  }

  if (packs.includes('memory')) {
    agents.push('- **Zecher** (זכר) — Memory Archivist — Consolidation, project scanning, context recall');
  }

  // Build memory section if memory pack is installed
  let memorySection = '';
  if (packs.includes('memory')) {
    memorySection = [
      '',
      '## Memory Protocol (Karpathy Guardrails)',
      '',
      'Agents MUST follow these behavioral principles:',
      '',
      '### G1 — Think Before Coding',
      '- State assumptions explicitly. If uncertain, ask.',
      '- Check `.agents/memory/decisions.md` for prior decisions before re-deciding.',
      '',
      '### G2 — Simplicity First',
      '- Minimum code that solves the problem. Nothing speculative.',
      '- Check `.agents/memory/patterns.md` for existing solutions.',
      '',
      '### G3 — Surgical Changes',
      '- Touch only what you must. Match existing style.',
      '- Log surprises in `.agents/memory/lessons.md`.',
      '',
      '### G4 — Goal-Driven Execution',
      '- Define success criteria before implementing.',
      '- Log non-obvious decisions in `.agents/memory/decisions.md`.',
      '',
      '### Memory Files',
      '- `.agents/memory/decisions.md` — Read at session start, write when making decisions',
      '- `.agents/memory/lessons.md` — Write when something unexpected happens',
      '- `.agents/memory/patterns.md` — Write when a reusable pattern is validated',
      '- `.agents/memory/context.md` — Update at session end with project state',
    ].join('\n');
  }

  return `# BMAD+ — AI Agent Configuration

## Project Context
This project uses BMAD+, an augmented AI-driven development framework.
Based on BMAD-METHOD v6.6.0 with multi-role agents, autopilot mode, and parallel execution.

## Agents
To activate an agent, say its name or persona:
${agents.join('\n')}

## Skills
- Load skills from \`.agents/skills/\`
- Each agent has a SKILL.md with capabilities, activation protocol, and role-switching rules
- Auto-activation triggers: \`.agents/data/role-triggers.yaml\`

## Key Commands
- \`bmad-help\` — Show all available agents and skills
- \`autopilot\` — Launch Nexus in full pipeline mode
- \`parallel\` — Enable parallel multi-agent execution

## Communication
- User name: ${userName}
- Default language: ${language} for user-facing content, English for code and technical docs.
${memorySection}`;
}

function generateConfigYaml(userName, language, projectDir) {
  const projectName = path.basename(projectDir);
  return `# BMAD+ Project Configuration
# Generated by bmad-plus install

user_name: "${userName}"
communication_language: "${language}"
document_output_language: "${language}"
output_folder: "_bmad-output"
project_name: "${projectName}"

# Execution settings
execution_mode: "manual"
auto_role_activation: true
parallel_execution: true
`;
}
