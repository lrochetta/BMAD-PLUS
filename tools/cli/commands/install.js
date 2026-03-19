/**
 * BMAD+ Install Command
 * Installs agents, skills, and IDE configs into the current project
 * Supports 9 languages: EN, FR, ES, DE, PT-BR, RU, ZH, HE, JA
 *
 * Author: Laurent Rochetta
 */

const path = require('node:path');
const fs = require('node:fs');
const fsExtra = require('fs-extra');
const clack = require('@clack/prompts');
const pc = require('picocolors');
const { t, getLanguageOptions, getCommLanguageOptions } = require('../i18n');

// Pack definitions
const PACKS = {
  core: {
    name: 'Core Development',
    icon: '⚙️',
    description: '4 multi-role agents (Atlas, Forge, Sentinel, Nexus)',
    required: true,
    agents: ['agent-strategist', 'agent-architect-dev', 'agent-quality', 'agent-orchestrator'],
    skills: ['bmad-plus-autopilot', 'bmad-plus-parallel', 'bmad-plus-sync'],
    data: ['role-triggers.yaml'],
  },
  osint: {
    name: 'OSINT Intelligence',
    icon: '🔍',
    description: 'Agent Shadow — investigation, scraping, psychoprofil',
    required: false,
    agents: ['agent-shadow'],
    skills: [],
    externalPackage: 'osint-agent-package',
  },
  maker: {
    name: 'Agent Creator',
    icon: '🧬',
    description: 'Maker — design, build, and package new BMAD+ agents',
    required: false,
    agents: ['agent-maker'],
    skills: [],
    data: [],
  },
  audit: {
    name: 'Audit Sécurité',
    icon: '🛡️',
    description: 'Agent Shield — scan vulnérabilités (bientôt)',
    required: false,
    disabled: true,
    agents: [],
    skills: [],
  },
  seo: {
    name: 'SEO Audit 360',
    icon: '🔍',
    description: '9-category audit for search engines + AI engines (by Oveanet)',
    required: false,
    agents: [],
    skills: [],
    oveanetAgent: 'seo-audit-360',
  },
  backup: {
    name: 'Universal Backup',
    icon: '🗂️',
    description: 'Timestamped ZIP backup with smart exclusions (by Oveanet)',
    required: false,
    agents: [],
    skills: [],
    oveanetAgent: 'universal-backup',
  },
  animated: {
    name: 'Animated Website',
    icon: '🎬',
    description: 'Luxury scroll-driven website from video (by Oveanet)',
    required: false,
    agents: [],
    skills: [],
    oveanetAgent: 'animated-website',
  },
};

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
    clack.intro(pc.bgCyan(pc.black(' BMAD+ Installer v0.4.1 ')));

    let lang = 'en';
    if (!options.yes) {
      const langChoice = await clack.select({
        message: '🌐 Select your language / Choisissez votre langue / 选择语言',
        options: getLanguageOptions(),
      });

      if (clack.isCancel(langChoice)) {
        clack.cancel('Installation cancelled.');
        process.exit(0);
      }
      lang = langChoice;
    }

    const i = t(lang); // Get translations for selected language

    // Verify source exists
    if (!fs.existsSync(bmadSrc)) {
      clack.log.error(`${i.source_not_found}: ${bmadSrc}`);
      clack.outro(pc.red(i.failed));
      process.exit(1);
    }

    clack.log.info(`${i.installing_to}: ${pc.cyan(projectDir)}`);

    // ── Step 1: Pack Selection ──
    let selectedPacks = ['core']; // Core always included

    if (options.packs) {
      const requested = options.packs.split(',').map(p => p.trim());
      if (requested.includes('all')) {
        selectedPacks = Object.keys(PACKS).filter(k => !PACKS[k].disabled);
      } else {
        selectedPacks = ['core', ...requested.filter(p => PACKS[p] && !PACKS[p].disabled)];
      }
    } else if (!options.yes) {
      const packChoice = await clack.multiselect({
        message: i.select_packs,
        options: Object.entries(PACKS)
          .filter(([, p]) => !p.required)
          .map(([key, pack]) => ({
            value: key,
            label: `${pack.icon} ${pack.name}`,
            hint: pack.disabled ? i.soon : pack.description,
            disabled: pack.disabled,
          })),
        required: false,
      });

      if (clack.isCancel(packChoice)) {
        clack.cancel(i.cancelled);
        process.exit(0);
      }

      selectedPacks = [...new Set(['core', ...packChoice])];
    }

    clack.log.success(`${i.selected_packs}: ${selectedPacks.map(p => `${PACKS[p].icon} ${PACKS[p].name}`).join(', ')}`);

    // ── Step 2: IDE Detection ──
    let detectedIDEs = [];

    if (options.tools) {
      detectedIDEs = options.tools.split(',').map(t => t.trim());
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
        process.exit(0);
      }

      userName = userConfig.userName;
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

    for (const packId of selectedPacks) {
      const pack = PACKS[packId];
      if (!pack || pack.disabled) continue;

      // Copy agents
      for (const agent of pack.agents) {
        const src = path.join(bmadSrc, 'agents', agent);
        const dest = path.join(targetAgentsDir, agent);
        if (fs.existsSync(src)) {
          fsExtra.copySync(src, dest, { overwrite: true });
          copiedAgents++;
        }
      }

      // Copy skills
      for (const skill of pack.skills) {
        const src = path.join(bmadSrc, 'skills', skill);
        const dest = path.join(targetAgentsDir, skill);
        if (fs.existsSync(src)) {
          fsExtra.copySync(src, dest, { overwrite: true });
          copiedSkills++;
        }
      }

      // Copy data files
      for (const dataFile of (pack.data || [])) {
        const src = path.join(bmadSrc, 'data', dataFile);
        const dest = path.join(targetDataDir, dataFile);
        if (fs.existsSync(src)) {
          fsExtra.copySync(src, dest, { overwrite: true });
          copiedFiles++;
        }
      }

      // Copy external package (OSINT)
      if (pack.externalPackage) {
        const extSrc = path.join(__dirname, '..', '..', '..', pack.externalPackage, 'skills');
        const extDest = path.join(targetAgentsDir);
        if (fs.existsSync(extSrc)) {
          fsExtra.copySync(extSrc, extDest, { overwrite: true });
          copiedSkills++;
        }
      }

      // Copy Oveanet agent pack (SEO, Backup, Animated Website)
      if (pack.oveanetAgent) {
        const oveanetSrc = path.join(__dirname, '..', '..', '..', 'oveanet-pack', pack.oveanetAgent);
        const oveanetDest = path.join(targetAgentsDir, pack.oveanetAgent);
        if (fs.existsSync(oveanetSrc)) {
          fsExtra.copySync(oveanetSrc, oveanetDest, { overwrite: true });
          copiedSkills++;
        }
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
    const manifest = {
      version: '0.4.0',
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

  if (packs.includes('audit')) {
    agents.push('- **Shield** (Audit) — Security scanning + Compliance');
  }

  return `# BMAD+ — AI Agent Configuration

## Project Context
This project uses BMAD+, an augmented AI-driven development framework.
Based on BMAD-METHOD v6.2.0 with multi-role agents, autopilot mode, and parallel execution.

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
`;
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
