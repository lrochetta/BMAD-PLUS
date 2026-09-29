/**
 * BMAD+ Install Command
 * Installs agents, skills, and IDE configs into the current project
 * Supports 10 languages: EN, FR, ES, DE, PT-BR, RU, ZH, HE, JA, IT
 *
 * Author: Laurent Rochetta
 */

const path = require('node:path');
const fs = require('node:fs');
const { isDeepStrictEqual } = require('node:util');
const fsExtra = require('fs-extra');
const semver = require('semver');
const clack = require('@clack/prompts');
const pc = require('picocolors');
const { t, LANGUAGES, getLanguageOptions, getCommLanguageOptions } = require('../i18n');
const { PACKS, DERIVED } = require('../lib/packs');
const { copyPackFiles, copyManagedFile } = require('../lib/pack-copy');
const {
  acquireProjectLock,
  atomicWrite,
  inventoryOf,
  collectManagedFiles,
} = require('../lib/update-transaction');
const { isExactVersion } = require('../lib/update-policy');
const { initMemory } = require('../lib/memory-init');
const { generateUserFiles, IDE_CONFIGS } = require('../../build/generate-adapters');
const { writeIDEConfigs, safeAdapterPath } = require('../lib/installed-adapters');
const { readInstallManifest } = require('../lib/install-manifest');
const yaml = require('js-yaml');
const { validateUserName } = require('../lib/validate');
const { provisionPack } = require('../lib/python-provision');

const PYTHON_PACKS = DERIVED.pythonPacks;

module.exports = {
  command: 'install',
  description: 'Install BMAD+ agents and skills into your project',
  options: [
    ['-d, --directory <path>', 'Installation directory (default: current directory)'],
    ['-p, --packs <packs>', 'Comma-separated pack IDs: core,osint,all (default: interactive)'],
    ['-y, --yes', 'Accept all defaults, skip prompts'],
    [
      '-l, --lang <code>',
      'Language code: en, fr, es, de, pt-br, ru, zh, he, ja, it (overrides auto-detection)',
    ],
    ['--tools <tools>', 'Comma-separated IDE IDs, all, or none (default: auto-detect)'],
    ['--mode <mode>', 'Execution mode: manual, autopilot, hybrid (default: manual)'],
    ['--provision-python', 'Provision isolated environments for selected Python packs'],
  ],
  action: async (options) => {
    // A closed/piped stdin cannot answer prompts. Require explicit defaults
    // before creating files, instead of silently exiting halfway through UI.
    if (!options.yes && !process.stdin.isTTY) {
      const i = t(options.lang || 'en');
      clack.log.error(i.noninteractive_requires_yes('install'));
      process.exitCode = 1;
      return;
    }

    const projectDir = path.resolve(options.directory || process.cwd());
    const bmadSrc = path.join(__dirname, '..', '..', '..', 'src', 'bmad-plus');
    const previousManifestPath = safeAdapterPath(projectDir, '_bmad/.bmad-plus-install.json');
    const previousManifestBytes = fs.existsSync(previousManifestPath)
      ? fs.readFileSync(previousManifestPath)
      : null;
    let previousManifest = null;
    let manifestError;
    if (fs.existsSync(previousManifestPath)) {
      try {
        previousManifest = readInstallManifest(previousManifestPath);
      } catch (error) {
        manifestError = error;
      }
    }
    if (options.mode && !['manual', 'autopilot', 'hybrid'].includes(options.mode))
      throw new Error('Unknown execution mode: ' + options.mode);
    const pkgJson = require('../../../package.json');

    // A version change must go through `update`: it plans, backs up, and records
    // a receipt. Install only adds packs/tools to (or repairs) the same version.
    const versionConflict = installedVersionConflict(previousManifest?.version, pkgJson.version);
    if (versionConflict) {
      clack.log.error(versionConflict);
      process.exitCode = 1;
      return;
    }
    const existingConfig = readExistingConfig(projectDir);
    const previousPacks = (previousManifest?.packs || []).filter((id) => Object.hasOwn(PACKS, id));
    const previousTools = (
      Array.isArray(previousManifest?.ides) ? previousManifest.ides : []
    ).filter((id) => Object.hasOwn(IDE_CONFIGS, id));
    const requestedPacks = parseRequestedPacks(options.packs);
    const requestedTools = parseRequestedTools(options.tools);

    // ── Step 0: Language Selection ──
    clack.intro(pc.bgCyan(pc.black(` BMAD+ Installer v${pkgJson.version} `)));
    clack.log.info(pc.dim('✨ Created by Laurent Rochetta — github.com/lrochetta/BMAD-PLUS'));

    let lang = options.lang || 'en';
    if (!options.yes && !options.lang) {
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
    // Core is always included; a re-install adds to the packs already installed.
    let chosenPacks = requestedPacks || [];

    if (!requestedPacks && !options.yes) {
      const packChoice = await clack.multiselect({
        message: i.select_packs,
        options: Object.entries(PACKS)
          .filter(([, p]) => !p.required)
          .map(([key, pack]) => ({
            value: key,
            label: packLabel(key),
            hint: pack.disabled ? i.soon : pack.desc || pack.description || '',
            disabled: pack.disabled,
          })),
        initialValues: previousPacks.filter((id) => !PACKS[id].required),
        required: false,
      });

      if (clack.isCancel(packChoice)) {
        clack.cancel(i.cancelled);
        throw new Error(i.cancelled);
      }

      chosenPacks = packChoice;
    }
    const selectedPacks = DERIVED.packOrder.filter(
      (id) => id === 'core' || previousPacks.includes(id) || chosenPacks.includes(id)
    );

    clack.log.success(`${i.selected_packs}: ${selectedPacks.map(packLabel).join(', ')}`);

    // ── Step 2: IDE Detection ──
    let detectedIDEs = [];

    if (requestedTools) {
      detectedIDEs = requestedTools;
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

      // --yes never guesses: without a detected tool, write no adapter.
      if (detectedIDEs.length === 0 && options.yes && previousTools.length === 0) {
        clack.log.info(
          pc.dim(
            'No AI tool detected; no instruction adapter written. Re-run with --tools <ids> or --tools all to add one.'
          )
        );
      }
    }
    // Keep refreshing adapters this installation already owns, unless skipped.
    const skipTools = options.tools === 'none' || options.tools === 'skip';
    if (!skipTools) detectedIDEs = [...new Set([...previousTools, ...detectedIDEs])];

    if (detectedIDEs.length > 0) {
      clack.log.info(
        `${i.detected_ides}: ${detectedIDEs.map((id) => IDE_CONFIGS[id].name).join(', ')}`
      );
    } else if (skipTools) {
      clack.log.info(pc.dim('⏭️  IDE config skipped (--tools none) — existing configs preserved'));
    }

    // ── Step 3: User Config ──
    // Existing settings are the defaults; unattended installs never replace them.
    let userName =
      typeof existingConfig?.user_name === 'string' && existingConfig.user_name
        ? existingConfig.user_name
        : process.env.USER || process.env.USERNAME || 'Developer';
    let commLang =
      typeof existingConfig?.communication_language === 'string' &&
      existingConfig.communication_language
        ? existingConfig.communication_language
        : communicationLanguage(options.lang || (options.yes ? undefined : lang));
    let execMode = options.mode || existingConfig?.execution_mode || 'manual';
    if (!['manual', 'autopilot', 'hybrid'].includes(execMode)) execMode = 'manual';
    let uatEnvironment = '';
    const explicitSettings = {};
    if (options.mode) explicitSettings.execution_mode = options.mode;

    if (!options.yes) {
      const userConfig = await clack.group({
        userName: () =>
          clack.text({
            message: i.enter_name,
            placeholder: userName,
            defaultValue: userName,
          }),
        commLang: () =>
          clack.select({
            message: i.comm_language,
            options: getCommLanguageOptions(),
            initialValue: commLang,
          }),
        uatEnvironment: () =>
          clack.text({
            message:
              i.uat_environment ||
              'Test environment for human acceptance recipes (URL, blank if none)',
            placeholder: 'https://demo.example.com',
            defaultValue: '',
          }),
        execMode: () =>
          clack.select({
            message: i.exec_mode,
            options: [
              { value: 'manual', label: i.exec_manual },
              { value: 'autopilot', label: i.exec_autopilot },
              { value: 'hybrid', label: i.exec_hybrid },
            ],
            initialValue: execMode,
          }),
      });

      if (clack.isCancel(userConfig)) {
        clack.cancel(i.cancelled);
        throw new Error(i.cancelled);
      }

      // Validate user-provided name
      const rawName = userConfig.userName;
      const fb = process.env.USER || process.env.USERNAME || 'Developer';
      const { name: validatedName, warnings } = validateUserName(rawName, fb);
      for (const w of warnings) clack.log.warn(w);
      // Answers given in the wizard are explicit and replace existing settings.
      if (userConfig.commLang !== commLang)
        explicitSettings.document_output_language = userConfig.commLang;
      userName = validatedName;
      commLang = userConfig.commLang;
      execMode = options.mode || userConfig.execMode;
      uatEnvironment = String(userConfig.uatEnvironment || '').trim();
      Object.assign(explicitSettings, {
        user_name: userName,
        communication_language: commLang,
        execution_mode: execMode,
      });
      if (uatEnvironment)
        explicitSettings.uat = { environment: { name: 'TEST', url: uatEnvironment } };
    }

    const releaseLock = acquireProjectLock(projectDir);
    try {
      const { safeTarget } = require('../../build/generate-adapters');
      const plannedFiles = collectManagedFiles({ projectDir, packs: selectedPacks });
      if (detectedIDEs.length)
        plannedFiles.push(
          ...generateUserFiles(DERIVED, {
            packs: selectedPacks,
            tools: detectedIDEs,
            userName,
            language: commLang,
          })
        );
      for (const { file } of plannedFiles) safeTarget(projectDir, file);
      safeTarget(projectDir, '_bmad/config.yaml');
      safeTarget(projectDir, '_bmad/.bmad-plus-install.json');
      for (const directory of [
        '.agents/skills',
        '.agents/data',
        '_bmad',
        '_bmad-output/discovery',
        '_bmad-output/build',
        'docs',
      ]) {
        safeTarget(projectDir, directory + '/.bmad-preflight');
      }
      const currentManifestBytes = fs.existsSync(previousManifestPath)
        ? fs.readFileSync(previousManifestPath)
        : null;
      if (
        previousManifestBytes === null
          ? currentManifestBytes !== null
          : currentManifestBytes === null || !previousManifestBytes.equals(currentManifestBytes)
      ) {
        throw new Error('Installation changed while preparing install. Please retry.');
      }
      // Preserve the unreadable manifest before repair; do not trust its ownership
      // hashes. The adapter writer will retain locally edited user instructions.
      if (manifestError) {
        const backupBase = '_bmad/.bmad-plus-install.json.corrupt.bak';
        let backupFile = backupBase;
        let index = 1;
        while (fs.existsSync(safeAdapterPath(projectDir, backupFile)))
          backupFile = `${backupBase}.${index++}`;
        const backupPath = safeAdapterPath(projectDir, backupFile);
        fs.copyFileSync(
          safeAdapterPath(projectDir, '_bmad/.bmad-plus-install.json'),
          backupPath,
          fs.constants.COPYFILE_EXCL
        );
        clack.log.warn(`${i.manifest_invalid(manifestError.message)}\nBackup: ${backupPath}`);
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
      const previousInventory = inventoryOf(previousManifest || {}) || {};
      const fileInventory = { ...previousInventory };
      let inventoryComplete = true;
      const onFileConflict = (file) => {
        if (!previousInventory[file]) inventoryComplete = false;
        clack.log.warn(`${file}: locally changed or unowned content preserved.`);
      };

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
          projectDir,
          inventory: fileInventory,
          previousInventory,
          onConflict: onFileConflict,
        });
        copiedAgents += result.copiedAgents;
        copiedSkills += result.copiedSkills;
        copiedFiles += result.copiedFiles;

        // Memory pack: initialize brain with existing brain detection.
        // Non-fatal: a read-only or missing home dir (containers, CI) must not
        // abort the install mid-flight and leave a manifest-less partial tree.
        if (packId === 'memory' && pack.packDir) {
          try {
            initMemory({ projectDir, bmadSrc, userName, commLang, selectedPacks });
          } catch (err) {
            clack.log.warn(
              `Memory/brain initialization failed (non-fatal, install continues): ${err.message}`
            );
          }
        }
      }

      // ── Python provisioning (opt-in) — for packs whose runtime needs Python ──
      // Off by default so `install` never spawns Python unless asked. Closes the
      // "SEO pack ships prompts that call scripts never installed" gap (PROD-02).
      if (options.provisionPython) {
        const pythonPacks = selectedPacks.filter((p) => PYTHON_PACKS[p]);
        for (const packId of pythonPacks) {
          const cfg = PYTHON_PACKS[packId];
          const requirementsPath = path.join(projectRoot, ...cfg.requirements);
          if (!fs.existsSync(requirementsPath)) {
            clack.log.warn(
              `Python provisioning skipped for ${packId}: ${requirementsPath} not found.`
            );
            continue;
          }
          const pySpinner = clack.spinner();
          pySpinner.start(`Provisioning Python runtime for ${PACKS[packId].name}…`);
          const res = provisionPack({
            envDir: path.join(projectDir, '.bmad', 'venv', packId),
            requirementsPath,
            verifyModules: cfg.verifyModules,
          });
          pySpinner.stop(
            res.ok
              ? `${PACKS[packId].name}: Python runtime ready (${res.tool}).`
              : `${PACKS[packId].name}: Python not provisioned — ${res.messages[res.messages.length - 1] || 'see guidance'}`
          );
          if (!res.ok) {
            clack.log.warn(
              `Run \`${PACKS[packId].name}\` Python tools after installing Python ≥3.11; the pack's prompts still work, only the local scripts need the runtime.`
            );
          }
        }
      }

      // Copy module config
      const moduleYaml = path.join(bmadSrc, 'module.yaml');
      if (fs.existsSync(moduleYaml)) {
        copyManagedFile({
          source: moduleYaml,
          target: path.join(targetBmadDir, 'module.yaml'),
          projectDir,
          inventory: fileInventory,
          previousInventory,
          onConflict: onFileConflict,
        });
        copiedFiles++;
      }

      const helpCsv = path.join(bmadSrc, 'module-help.csv');
      if (fs.existsSync(helpCsv)) {
        copyManagedFile({
          source: helpCsv,
          target: path.join(targetBmadDir, 'module-help.csv'),
          projectDir,
          inventory: fileInventory,
          previousInventory,
          onConflict: onFileConflict,
        });
        copiedFiles++;
      }

      spinner.stop(i.installed_summary(copiedAgents, copiedSkills, copiedFiles));

      // ── Step 5: Generate IDE Configs ──
      let adapterHashes = previousManifest?.adapterHashes || {};
      if (detectedIDEs.length > 0) {
        const ideSpinner = clack.spinner();
        ideSpinner.start(i.configuring_ides);

        const outcome = writeIDEConfigs({
          projectDir,
          files: generateUserFiles(DERIVED, {
            packs: selectedPacks,
            userName,
            language: commLang,
            tools: detectedIDEs,
          }),
          adapterHashes,
          yes: options.yes,
        });
        adapterHashes = { ...adapterHashes, ...outcome.adapterHashes };

        ideSpinner.stop(i.ide_configured(detectedIDEs.length));
      }

      // ── Step 6: Create config.yaml ──
      const configYaml = generateConfigYaml(
        userName,
        commLang,
        projectDir,
        execMode,
        uatEnvironment
      );
      const configPath = path.join(targetBmadDir, 'config.yaml');
      if (!fs.existsSync(configPath)) {
        atomicWrite(projectDir, '_bmad/config.yaml', configYaml);
      } else {
        const merged = mergeConfigYaml(
          fs.readFileSync(configPath, 'utf8'),
          configYaml,
          explicitSettings
        );
        if (merged === null)
          clack.log.warn('_bmad/config.yaml could not be parsed; it was left unchanged.');
        else if (merged.changed) atomicWrite(projectDir, '_bmad/config.yaml', merged.content);
      }

      // ── Step 7: Create output directories ──
      const outputDir = path.join(projectDir, '_bmad-output');
      fsExtra.ensureDirSync(path.join(outputDir, 'discovery'));
      fsExtra.ensureDirSync(path.join(outputDir, 'build'));
      fsExtra.ensureDirSync(path.join(projectDir, 'docs'));

      // ── Step 8: Write install manifest ──
      const manifest = {
        version: pkgJson.version,
        uiLanguage: lang,
        installed: previousManifest?.installed || new Date().toISOString(),
        ...(previousManifest ? { lastInstalled: new Date().toISOString() } : {}),
        packs: selectedPacks,
        ides: [...new Set([...previousTools, ...detectedIDEs])],
        adapterHashes,
        fileInventory: { schemaVersion: 1, complete: inventoryComplete, files: fileInventory },
        executionMode: execMode,
        user: userName,
        language: commLang,
      };
      atomicWrite(projectDir, '_bmad/.bmad-plus-install.json', JSON.stringify(manifest, null, 2));

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
        agentGuide.push(
          `  ${(i.guide_shield || '🛡️ GRC Compliance').padEnd(28)} →  "Shield, audit my SaaS for GDPR"`
        );
      }

      if (selectedPacks.includes('memory')) {
        agentGuide.push(
          `  ${(i.guide_memory || '🧠 Memory Brain').padEnd(28)} →  "Zecher, scan projects in [path]"`
        );
      }

      if (selectedPacks.includes('dev-studio')) {
        agentGuide.push(
          `  ${(i.guide_dev_studio || '🏗️ Dev Studio').padEnd(28)} →  "Miriam, brainstorm my app idea"`
        );
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
        `  npx bmad-plus uninstall  ${i.guide_cli_uninstall || '— Remove BMAD+ from project'}`
      );

      // Add pack-specific examples
      const examples = [];
      if (selectedPacks.includes('seo')) {
        examples.push(`  ${i.guide_example_seo || '🔍 SEO: "/seo audit https://example.com"'}`);
      }
      if (selectedPacks.includes('backup')) {
        examples.push(
          `  ${i.guide_example_backup || '🗂️  Backup: "/backup create" → ZIP timestamped'}`
        );
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
          `  ${i.guide_example_shield_3 || '🛡️ GRC: "Shield, generate SOC 2 evidence checklist"'}`
        );
      }
      if (selectedPacks.includes('dev-studio')) {
        examples.push(
          `  ${i.guide_example_dev_studio_1 || '🏗️ Dev Studio: "Miriam, brainstorm a productivity app"'}`,
          `  ${i.guide_example_dev_studio_2 || '🏗️ Dev Studio: "Bezalel, design the architecture"'}`,
          `  ${i.guide_example_dev_studio_3 || '🏗️ Dev Studio: "Oholiab, implement story S1"'}`
        );
      }
      if (selectedPacks.includes('memory')) {
        examples.push(
          `  ${i.guide_example_memory_1 || '🧠 Memory: "Zecher, scan projects in ~/projects"'}`,
          `  ${i.guide_example_memory_2 || '🧠 Memory: "Zecher, where were we?"'}`,
          `  ${i.guide_example_memory_3 || '🧠 Memory: "Zecher, consolidate memory"'}`
        );
      }

      if (examples.length > 0) {
        agentGuide.push('', `💡 ${i.guide_examples_title || 'Quick Examples'}:`, ...examples);
      }

      agentGuide.push('', '---', i.guide_credits);

      clack.note(agentGuide.join('\n'), i.guide_title);

      clack.outro(pc.green(i.guide_ready));
    } finally {
      releaseLock();
    }
  },
  // Exported for functional testing (not part of the public API)
  _internal: {
    writeIDEConfigs,
    generateConfigYaml,
    mergeConfigYaml,
    communicationLanguage,
    installedVersionConflict,
  },
};

function packLabel(id) {
  const icon = DERIVED.packs[id]?.iconEmoji;
  return (icon ? icon + ' ' : '') + PACKS[id].name;
}

/** Refuse any version change; `update` owns upgrades and downgrades are never silent. */
function installedVersionConflict(installed, executing) {
  if (
    !installed ||
    installed === executing ||
    !isExactVersion(installed) ||
    !isExactVersion(executing)
  )
    return null;
  if (semver.gt(installed, executing)) {
    return (
      `Downgrade refused: BMAD+ v${installed} is installed and this package is v${executing}. ` +
      'Run a newer package (npx bmad-plus@latest install), or `bmad-plus update --latest` to check for updates.'
    );
  }
  return (
    `BMAD+ v${installed} is installed; this package is v${executing}. ` +
    'Run `bmad-plus update` first (it backs up changed files and records a restorable receipt), ' +
    'then re-run install to add packs or tools.'
  );
}

function parseList(value) {
  return String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

/** Explicit pack IDs; unknown IDs fail instead of being silently dropped. */
function parseRequestedPacks(value) {
  if (value === undefined) return null;
  const requested = parseList(value);
  const available = Object.keys(PACKS).filter((id) => !PACKS[id].disabled);
  if (requested.includes('all')) return available;
  const unknown = requested.filter((id) => id !== 'none' && !available.includes(id));
  if (unknown.length) {
    throw new Error(
      `Unknown pack ID(s): ${unknown.join(', ')}. Available: ${available.join(', ')}, all.`
    );
  }
  return requested.filter((id) => id !== 'none');
}

function parseRequestedTools(value) {
  if (value === undefined) return null;
  if (value === 'none' || value === 'skip') return [];
  const available = Object.keys(IDE_CONFIGS);
  const requested = parseList(value);
  if (requested.includes('all')) return available;
  const unknown = requested.filter((id) => !available.includes(id));
  if (unknown.length) {
    throw new Error(
      `Unknown tool ID(s): ${unknown.join(', ')}. Available: ${available.join(', ')}, all, none.`
    );
  }
  return [...new Set(requested)];
}

/** Communication language name from --lang, then the system locale; English otherwise. */
function communicationLanguage(code, locale = Intl.DateTimeFormat().resolvedOptions().locale) {
  const candidates = [code, locale, String(locale || '').split('-')[0]]
    .filter(Boolean)
    .map((value) => String(value).toLowerCase());
  for (const candidate of candidates) {
    if (Object.hasOwn(LANGUAGES, candidate)) return LANGUAGES[candidate].name;
  }
  return 'English';
}

function readExistingConfig(projectDir) {
  try {
    const parsed = yaml.load(
      fs.readFileSync(path.join(projectDir, '_bmad', 'config.yaml'), 'utf8')
    );
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Existing keys win, missing defaults are added; explicit answers replace. */
function mergeSettings(existing, defaults, explicit) {
  const merged = { ...existing };
  for (const [key, value] of Object.entries(defaults)) {
    if (!(key in merged)) merged[key] = value;
    else if (isPlainObject(merged[key]) && isPlainObject(value))
      merged[key] = mergeSettings(merged[key], value, {});
  }
  for (const [key, value] of Object.entries(explicit)) {
    merged[key] =
      isPlainObject(value) && isPlainObject(merged[key])
        ? mergeSettings(merged[key], {}, value)
        : value;
  }
  return merged;
}

/** Returns null when the existing file is not a YAML mapping (left untouched). */
function mergeConfigYaml(existingText, generatedText, explicit = {}) {
  let existing;
  try {
    existing = yaml.load(existingText);
  } catch {
    return null;
  }
  if (!isPlainObject(existing)) return null;
  const merged = mergeSettings(existing, yaml.load(generatedText), explicit);
  if (isDeepStrictEqual(merged, existing)) return { changed: false, content: existingText };
  return {
    changed: true,
    content:
      '# BMAD+ Project Configuration\n# Generated by bmad-plus install; existing settings preserved\n\n' +
      yaml.dump(merged, { lineWidth: -1, forceQuotes: true, quotingType: '"' }),
  };
}

function generateConfigYaml(
  userName,
  language,
  projectDir,
  execMode = 'manual',
  uatEnvironment = ''
) {
  if (!['manual', 'autopilot', 'hybrid'].includes(execMode))
    throw new Error('Unknown execution mode: ' + execMode);
  return (
    '# BMAD+ Project Configuration\n# Generated by bmad-plus install\n\n' +
    yaml.dump(
      {
        user_name: userName,
        communication_language: language,
        document_output_language: language,
        output_folder: '_bmad-output',
        project_name: path.basename(projectDir),
        execution_mode: execMode,
        auto_role_activation: true,
        parallel_execution: true,
        checkpoints: {
          discovery: 'require_approval',
          architecture: 'require_approval',
          story: execMode === 'autopilot' ? 'notify_only' : 'require_approval',
          delivery: 'require_approval',
        },
        // Human acceptance recipes. advisory: every delivery produces and offers its page and
        // nothing is ever blocked. gate: the delivery waits for a passing "bmad-plus uat gate".
        // off: no recipe, and the delivery report says so.
        uat: {
          mode: 'advisory',
          granularity: 'delivery',
          environment: { name: uatEnvironment ? 'TEST' : '', url: uatEnvironment || '' },
          page_budget: { max_steps: 15, max_minutes: 30 },
          dir: '_bmad-output/uat',
        },
      },
      { lineWidth: -1, forceQuotes: true, quotingType: '"' }
    )
  );
}
