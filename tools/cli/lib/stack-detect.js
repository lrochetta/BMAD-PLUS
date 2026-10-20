/**
 * BMAD+ Stack Detection — Shared Module
 * Unified project stack detection for autoconfig and scan commands.
 * Merges patterns from both original implementations.
 */

const path = require('node:path');
const fs = require('node:fs');

// ── Project Detection Markers (for scan.js) ──

const PROJECT_MARKERS = [
  {
    file: 'package.json',
    stack: 'Node.js',
    detect: (dir) => {
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
      } catch {
        return 'Node.js';
      }
    },
  },
  { file: 'Cargo.toml', stack: 'Rust' },
  { file: 'pyproject.toml', stack: 'Python' },
  { file: 'requirements.txt', stack: 'Python' },
  { file: 'go.mod', stack: 'Go' },
  { file: 'composer.json', stack: 'PHP' },
  { file: 'Gemfile', stack: 'Ruby' },
  { file: 'pom.xml', stack: 'Java' },
  { file: 'build.gradle', stack: 'Java/Kotlin' },
];

// ── Full Stack Detection (for autoconfig.js) ──

function detectStack(dir) {
  const result = {
    language: null,
    framework: null,
    runtime: null,
    packageManager: null,
    hasTypeScript: false,
  };

  // Package.json analysis
  const pkgPath = path.join(dir, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      result.runtime = 'Node.js';
      result.language =
        deps['typescript'] || fs.existsSync(path.join(dir, 'tsconfig.json'))
          ? 'TypeScript'
          : 'JavaScript';
      result.hasTypeScript = result.language === 'TypeScript';

      // Framework detection
      if (deps['next']) result.framework = 'Next.js';
      else if (deps['nuxt']) result.framework = 'Nuxt';
      else if (deps['@angular/core']) result.framework = 'Angular';
      else if (deps['react']) result.framework = 'React';
      else if (deps['vue']) result.framework = 'Vue.js';
      else if (deps['svelte']) result.framework = 'Svelte';
      else if (deps['express']) result.framework = 'Express';
      else if (deps['fastify']) result.framework = 'Fastify';
      else if (deps['hono']) result.framework = 'Hono';
      else if (deps['electron']) result.framework = 'Electron';
      else if (deps['tauri']) result.framework = 'Tauri';
      else if (deps['react-native']) result.framework = 'React Native';

      // Package manager
      if (fs.existsSync(path.join(dir, 'pnpm-lock.yaml'))) result.packageManager = 'pnpm';
      else if (fs.existsSync(path.join(dir, 'yarn.lock'))) result.packageManager = 'yarn';
      else if (fs.existsSync(path.join(dir, 'bun.lockb'))) result.packageManager = 'bun';
      else result.packageManager = 'npm';
    } catch (e) {
      console.warn('stack-detect: Failed to parse package.json in detectStack', e.message);
    }
  }

  // Other languages
  if (!result.runtime) {
    if (fs.existsSync(path.join(dir, 'Cargo.toml'))) {
      result.language = 'Rust';
      result.runtime = 'Rust';
    } else if (
      fs.existsSync(path.join(dir, 'pyproject.toml')) ||
      fs.existsSync(path.join(dir, 'requirements.txt'))
    ) {
      result.language = 'Python';
      result.runtime = 'Python';
    } else if (fs.existsSync(path.join(dir, 'go.mod'))) {
      result.language = 'Go';
      result.runtime = 'Go';
    } else if (fs.existsSync(path.join(dir, 'composer.json'))) {
      result.language = 'PHP';
      result.runtime = 'PHP';
    } else if (fs.existsSync(path.join(dir, 'Gemfile'))) {
      result.language = 'Ruby';
      result.runtime = 'Ruby';
    } else if (
      fs.existsSync(path.join(dir, 'pom.xml')) ||
      fs.existsSync(path.join(dir, 'build.gradle'))
    ) {
      result.language = 'Java';
      result.runtime = 'JVM';
    }
  }

  return result;
}

module.exports = {
  detectStack,
  PROJECT_MARKERS,
};
