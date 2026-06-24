/**
 * BMAD+ Shared PACKS Module
 * Single source of truth for pack definitions, expected agents, and pack ordering.
 *
 * Author: Laurent Rochetta
 */

const PACKS = {
  core: {
    name: 'Core',
    icon: 'b',
    agents: ['agent-strategist', 'agent-architect-dev', 'agent-quality', 'agent-orchestrator'],
    skills: ['bmad-plus-autopilot', 'bmad-plus-parallel', 'bmad-plus-sync'],
    data: ['role-triggers.yaml'],
    packDir: 'pack-core',
    packSrcDir: 'packs',
    required: true,
    desc: 'Core agents & skills',
  },
  osint: {
    name: 'OSINT',
    icon: 'j',
    agents: ['agent-shadow'],
    skills: [],
    externalPackage: 'osint-agent-package',
    packDir: 'pack-osint',
    packSrcDir: 'packs',
    desc: 'OSINT & investigation',
  },
  maker: {
    name: 'Maker',
    icon: 'f',
    agents: ['agent-maker'],
    skills: [],
    data: [],
    packDir: 'pack-maker',
    packSrcDir: 'packs',
    desc: 'Agent creation toolkit',
  },
  shield: {
    name: 'Shield',
    icon: 'm',
    agents: ['shield-orchestrator'],
    skills: [],
    packDir: 'pack-shield',
    packSrcDir: 'packs',
    desc: 'GRC compliance (25+ frameworks)',
  },
  seo: {
    name: 'SEO',
    icon: 'k',
    agents: ['seo-scout', 'seo-chief', 'seo-judge'],
    skills: [],
    packDir: 'pack-seo',
    packSrcDir: 'packs',
    desc: 'SEO audit & optimization',
  },
  memory: {
    name: 'Memory',
    icon: 'x',
    agents: ['zecher'],
    skills: [],
    packDir: 'pack-memory',
    packSrcDir: 'packs',
    desc: 'Persistent cross-session memory',
  },
  'dev-studio': {
    name: 'Dev Studio',
    icon: 'v',
    agents: ['dev-studio-orchestrator'],
    skills: ['dev-studio'],
    packDir: 'pack-dev-studio',
    packSrcDir: 'packs',
    desc: 'SDLC automation (6 agents, 56+ skills)',
  },
  backup: {
    name: 'Backup',
    icon: 'y',
    agents: ['backup-agent'],
    skills: [],
    packDir: 'pack-backup',
    packSrcDir: 'packs',
    desc: 'Backup & restore',
  },
  animated: {
    name: 'Animated',
    icon: 'z',
    agents: ['animated-website-agent'],
    skills: [],
    packDir: 'pack-animated',
    packSrcDir: 'packs',
    desc: 'Animated website agents',
  },
};

const PACK_ORDER = ['core', 'osint', 'maker', 'shield', 'seo', 'memory', 'dev-studio', 'backup', 'animated'];

/**
 * Maps each pack to the list of directory names expected under .agents/skills/
 * after installation. Each entry contains agent directory names AND/OR pack directory names.
 */
const EXPECTED_AGENTS = {
  core:       { agents: ['agent-strategist', 'agent-architect-dev', 'agent-quality', 'agent-orchestrator'], packDir: null },
  osint:      { agents: ['agent-shadow'],                                                                    packDir: null },
  maker:      { agents: ['agent-maker'],                                                                     packDir: null },
  shield:     { agents: ['shield-orchestrator'],                                                             packDir: 'pack-shield' },
  seo:        { agents: ['seo-scout', 'seo-chief', 'seo-judge'],                                             packDir: 'pack-seo' },
  memory:     { agents: ['zecher'],                                                                          packDir: 'pack-memory' },
  'dev-studio':  { agents: ['dev-studio-orchestrator'],                                                       packDir: 'pack-dev-studio' },
  backup:     { agents: ['backup-agent'],                                                                    packDir: 'pack-backup' },
  animated:   { agents: ['animated-website-agent'],                                                          packDir: 'pack-animated' },
};

module.exports = { PACKS, PACK_ORDER, EXPECTED_AGENTS };
