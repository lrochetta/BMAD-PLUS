/**
 * BMAD+ Install Command
 * Installs agents, skills, and IDE configs into the current project
 */

const path = require('node:path');
const fs = require('node:fs');
const fsExtra = require('fs-extra');
const clack = require('@clack/prompts');
const pc = require('picocolors');

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

    // ── Intro ──
    clack.intro(pc.bgCyan(pc.black(' BMAD+ Installer v0.1.0 ')));

    // Verify source exists
    if (!fs.existsSync(bmadSrc)) {
      clack.log.error(`Source directory not found: ${bmadSrc}`);
      clack.outro(pc.red('Installation failed.'));
      process.exit(1);
    }

    clack.log.info(`Installing to: ${pc.cyan(projectDir)}`);

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
        message: 'Quels packs installer ? (Core est toujours inclus)',
        options: Object.entries(PACKS)
          .filter(([, p]) => !p.required)
          .map(([key, pack]) => ({
            value: key,
            label: `${pack.icon} ${pack.name}`,
            hint: pack.disabled ? 'bientôt' : pack.description,
            disabled: pack.disabled,
          })),
        required: false,
      });

      if (clack.isCancel(packChoice)) {
        clack.cancel('Installation annulée.');
        process.exit(0);
      }

      selectedPacks = [...new Set(['core', ...packChoice])];
    }

    clack.log.success(`Packs sélectionnés: ${selectedPacks.map(p => `${PACKS[p].icon} ${PACKS[p].name}`).join(', ')}`);

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
          message: 'Quels IDE utilises-tu ?',
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
      clack.log.info(`IDE détectés: ${detectedIDEs.map(id => IDE_CONFIGS[id].name).join(', ')}`);
    }

    // ── Step 3: User Config ──
    let userName = process.env.USER || process.env.USERNAME || 'Developer';
    let commLang = 'French';

    if (!options.yes) {
      const userConfig = await clack.group({
        userName: () => clack.text({
          message: 'Ton prénom (les agents l\'utilisent pour te saluer)',
          placeholder: userName,
          defaultValue: userName,
        }),
        commLang: () => clack.select({
          message: 'Langue de communication',
          options: [
            { value: 'French', label: '🇫🇷 Français' },
            { value: 'English', label: '🇬🇧 English' },
            { value: 'German', label: '🇩🇪 Deutsch' },
            { value: 'Spanish', label: '🇪🇸 Español' },
          ],
        }),
        execMode: () => clack.select({
          message: 'Mode d\'exécution',
          options: [
            { value: 'manual', label: 'Manuel — Tu appelles les agents toi-même' },
            { value: 'autopilot', label: 'Autopilot — Nexus gère tout le pipeline' },
            { value: 'hybrid', label: 'Hybride — Autopilot avec checkpoints fréquents' },
          ],
        }),
      });

      if (clack.isCancel(userConfig)) {
        clack.cancel('Installation annulée.');
        process.exit(0);
      }

      userName = userConfig.userName;
      commLang = userConfig.commLang;
    }

    // ── Step 4: Install Files ──
    const spinner = clack.spinner();
    spinner.start('Installation des fichiers...');

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

    spinner.stop(`✅ ${copiedAgents} agents, ${copiedSkills} skills, ${copiedFiles} fichiers copiés`);

    // ── Step 5: Generate IDE Configs ──
    if (detectedIDEs.length > 0) {
      const ideSpinner = clack.spinner();
      ideSpinner.start('Configuration des IDE...');

      const configContent = generateIDEConfig(userName, commLang, selectedPacks);

      for (const ideId of detectedIDEs) {
        const ide = IDE_CONFIGS[ideId];
        if (!ide) continue;

        const configPath = path.join(projectDir, ide.configFile);
        fs.writeFileSync(configPath, configContent, 'utf8');
      }

      ideSpinner.stop(`✅ ${detectedIDEs.length} IDE configuré(s)`);
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
      version: '0.1.0',
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
      '💬 À qui parler ?',
      '',
      '  Discuter d\'une idée      →  "Atlas, j\'ai une idée de projet : [...]"',
      '  Créer un PRD              →  "Atlas, crée le PRD"',
      '  Architecture technique    →  "Forge, propose une architecture"',
      '  Implémenter du code       →  "Forge, implémente la story [X]"',
      '  Tester / code review      →  "Sentinel, review le module [X]"',
      '  Planifier un sprint       →  "Nexus, crée les epics et stories"',
      '  Tout automatiser          →  "autopilot" puis décris ton projet',
    ];

    if (selectedPacks.includes('osint')) {
      agentGuide.push('  Investigation OSINT       →  "Shadow, investigate [nom]"');
    }

    if (selectedPacks.includes('maker')) {
      agentGuide.push('  Créer un nouvel agent     →  "Maker, crée un agent [description]"');
    }

    agentGuide.push(
      '',
      '🚀 Workflow recommandé:',
      '  1. Atlas (idée → brief → PRD)',
      '  2. Forge (architecture → code)',
      '  3. Sentinel (tests → review)',
      '',
      '⚡ Ou: "autopilot" pour tout gérer automatiquement',
      '',
      `📁 Output: _bmad-output/discovery/ et _bmad-output/build/`,
      '',
      '---',
      '✨ BMAD+ is created by Laurent Rochetta — github.com/lrochetta | linkedin.com/in/laurentrochetta ✨'
    );

    clack.note(agentGuide.join('\n'), '✅ Installation terminée — Comment commencer');

    clack.outro(pc.green('BMAD+ est prêt! Parle à Atlas pour commencer 🚀'));
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
