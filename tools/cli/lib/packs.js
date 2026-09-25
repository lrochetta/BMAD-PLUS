/**
 * BMAD+ Shared PACKS Module — AUTO-GENERATED, DO NOT EDIT.
 * Source of truth: registry.yaml (repo root).
 * Regenerate: node tools/build/generate.js --out tools/cli/lib/packs.js
 *
 * Author: Laurent Rochetta
 */

const PACKS = {
  "core": {
    "name": "Core",
    "icon": "b",
    "agents": [
      "agent-strategist",
      "agent-architect-dev",
      "agent-quality",
      "agent-orchestrator"
    ],
    "skills": [
      "bmad-plus-autopilot",
      "bmad-plus-parallel",
      "bmad-plus-sync",
      "bmad-plus-uat"
    ],
    "data": [
      "role-triggers.yaml"
    ],
    "required": true,
    "desc": "Core agents & skills"
  },
  "osint": {
    "name": "OSINT",
    "icon": "j",
    "agents": [
      "agent-shadow"
    ],
    "skills": [],
    "externalPackage": "osint-agent-package",
    "desc": "OSINT & investigation"
  },
  "maker": {
    "name": "Maker",
    "icon": "f",
    "agents": [
      "agent-maker"
    ],
    "skills": [],
    "data": [],
    "desc": "Agent creation toolkit"
  },
  "shield": {
    "name": "Shield",
    "icon": "m",
    "agents": [],
    "skills": [],
    "packDir": "pack-shield",
    "packSrcDir": "packs",
    "desc": "GRC compliance (26 frameworks)"
  },
  "seo": {
    "name": "SEO",
    "icon": "k",
    "agents": [],
    "skills": [],
    "packDir": "pack-seo",
    "packSrcDir": "packs",
    "desc": "SEO audit & optimization"
  },
  "memory": {
    "name": "Memory",
    "icon": "x",
    "agents": [],
    "skills": [],
    "packDir": "pack-memory",
    "packSrcDir": "packs",
    "desc": "Persistent cross-session memory"
  },
  "dev-studio": {
    "name": "Dev Studio",
    "icon": "v",
    "agents": [],
    "skills": [
      "dev-studio"
    ],
    "packDir": "pack-dev-studio",
    "packSrcDir": "packs",
    "desc": "SDLC automation (6 agents, specialized workflows)"
  },
  "backup": {
    "name": "Backup",
    "icon": "y",
    "agents": [],
    "skills": [],
    "packDir": "pack-backup",
    "packSrcDir": "packs",
    "desc": "Backup & restore"
  },
  "animated": {
    "name": "Animated",
    "icon": "z",
    "agents": [],
    "skills": [],
    "packDir": "pack-animated",
    "packSrcDir": "packs",
    "desc": "Animated website agents"
  }
};

const PACK_ORDER = [
  "core",
  "osint",
  "maker",
  "shield",
  "seo",
  "memory",
  "dev-studio",
  "backup",
  "animated"
];

const EXPECTED_AGENTS = {
  "core": {
    "agents": [
      "agent-strategist",
      "agent-architect-dev",
      "agent-quality",
      "agent-orchestrator"
    ],
    "packDir": null
  },
  "osint": {
    "agents": [
      "agent-shadow"
    ],
    "packDir": null
  },
  "maker": {
    "agents": [
      "agent-maker"
    ],
    "packDir": null
  },
  "shield": {
    "agents": [],
    "packDir": "pack-shield",
    "packAgents": [
      "shield-orchestrator.md"
    ]
  },
  "seo": {
    "agents": [],
    "packDir": "pack-seo",
    "packAgents": [
      "seo-scout.md",
      "seo-chief.md",
      "seo-judge.md"
    ]
  },
  "memory": {
    "agents": [],
    "packDir": "pack-memory",
    "packAgents": [
      "zecher-agent.md",
      "memory-orchestrator.md"
    ]
  },
  "dev-studio": {
    "agents": [],
    "packDir": "pack-dev-studio",
    "packAgents": [
      "dev-studio-orchestrator.md"
    ]
  },
  "backup": {
    "agents": [],
    "packDir": "pack-backup",
    "packAgents": [
      "backup-agent.md"
    ]
  },
  "animated": {
    "agents": [],
    "packDir": "pack-animated",
    "packAgents": [
      "animated-website-agent.md"
    ]
  }
};

const DERIVED = {
  "product": {
    "code": "bmad-plus",
    "displayName": "BMAD+",
    "version": "0.18.0",
    "derivedFrom": "BMAD-METHOD v6.6.0"
  },
  "packOrder": [
    "core",
    "osint",
    "maker",
    "shield",
    "seo",
    "memory",
    "dev-studio",
    "backup",
    "animated"
  ],
  "packCount": 9,
  "installerAgents": 14,
  "totalAgents": 47,
  "languages": [
    "en",
    "fr",
    "es",
    "de",
    "pt-br",
    "ru",
    "zh",
    "he",
    "ja",
    "it"
  ],
  "packs": {
    "core": {
      "id": "core",
      "order": 0,
      "name": "Core",
      "displayName": "Core Development",
      "iconEmoji": "⚙️",
      "required": true,
      "installerAgentCount": 4,
      "categoryAgentCount": 0,
      "agentCount": 4,
      "subAgentCount": 0,
      "workflowCount": 0,
      "frameworkCount": 0,
      "categoryCount": 0,
      "skillCount": 4,
      "referenceFiles": 0,
      "categoryAgentCounts": [],
      "runtimes": [
        "node"
      ],
      "requiredResources": [
        ".agents/skills/agent-strategist/SKILL.md",
        ".agents/skills/agent-architect-dev/SKILL.md",
        ".agents/skills/agent-quality/SKILL.md",
        ".agents/skills/agent-orchestrator/SKILL.md",
        ".agents/skills/bmad-plus-autopilot/SKILL.md",
        ".agents/skills/bmad-plus-parallel/SKILL.md",
        ".agents/skills/bmad-plus-sync/SKILL.md",
        ".agents/skills/bmad-plus-uat/SKILL.md",
        ".agents/data/role-triggers.yaml"
      ],
      "personas": [
        {
          "id": "agent-strategist",
          "name": "Atlas",
          "role": "Strategist",
          "description": "Business analysis + Product management"
        },
        {
          "id": "agent-architect-dev",
          "name": "Forge",
          "role": "Architect-Dev",
          "description": "Architecture + Development + Documentation"
        },
        {
          "id": "agent-quality",
          "name": "Sentinel",
          "role": "Quality",
          "description": "QA + UX review"
        },
        {
          "id": "agent-orchestrator",
          "name": "Nexus",
          "role": "Orchestrator",
          "description": "Sprint management + Autopilot + Parallel execution"
        }
      ],
      "summary": "Multi-role agents for the full development lifecycle.",
      "desc": "Core agents & skills",
      "description": "Core agents & skills"
    },
    "osint": {
      "id": "osint",
      "order": 1,
      "name": "OSINT",
      "displayName": "OSINT Intelligence",
      "iconEmoji": "🔍",
      "required": false,
      "installerAgentCount": 1,
      "categoryAgentCount": 0,
      "agentCount": 1,
      "subAgentCount": 0,
      "workflowCount": 0,
      "frameworkCount": 2,
      "categoryCount": 0,
      "skillCount": 0,
      "referenceFiles": 0,
      "categoryAgentCounts": [],
      "runtimes": [
        "node"
      ],
      "requiredResources": [
        ".agents/skills/agent-shadow/SKILL.md"
      ],
      "personas": [
        {
          "id": "agent-shadow",
          "name": "Shadow",
          "role": "OSINT",
          "description": "Investigation + Public-source research (governed, legal basis required)"
        }
      ],
      "summary": "Investigation & scraping (55+ Apify actors, 7 APIs).",
      "desc": "OSINT & investigation",
      "description": "OSINT & investigation"
    },
    "maker": {
      "id": "maker",
      "order": 2,
      "name": "Maker",
      "displayName": "Agent Creator",
      "iconEmoji": "🧬",
      "required": false,
      "installerAgentCount": 1,
      "categoryAgentCount": 0,
      "agentCount": 1,
      "subAgentCount": 0,
      "workflowCount": 0,
      "frameworkCount": 0,
      "categoryCount": 0,
      "skillCount": 0,
      "referenceFiles": 0,
      "categoryAgentCounts": [],
      "runtimes": [
        "node"
      ],
      "requiredResources": [
        ".agents/skills/agent-maker/SKILL.md"
      ],
      "personas": [
        {
          "id": "agent-maker",
          "name": "Maker",
          "role": "Agent Creator",
          "description": "Design, build, validate, and package new BMAD+ agents"
        }
      ],
      "summary": "Design, build, validate, and package new BMAD+-compatible agents.",
      "desc": "Agent creation toolkit",
      "description": "Agent creation toolkit"
    },
    "shield": {
      "id": "shield",
      "order": 3,
      "name": "Shield",
      "displayName": "Shield — GRC Compliance",
      "iconEmoji": "🛡️",
      "required": false,
      "installerAgentCount": 1,
      "categoryAgentCount": 27,
      "agentCount": 27,
      "subAgentCount": 0,
      "workflowCount": 11,
      "frameworkCount": 26,
      "categoryCount": 6,
      "skillCount": 0,
      "referenceFiles": 79,
      "categoryAgentCounts": [
        5,
        6,
        6,
        4,
        3,
        3
      ],
      "runtimes": [
        "node"
      ],
      "requiredResources": [
        ".agents/skills/pack-shield/shield-orchestrator.md",
        ".agents/skills/pack-shield/SKILL.md"
      ],
      "personas": [
        {
          "id": "shield-orchestrator",
          "name": "Shield",
          "role": "GRC",
          "description": "Compliance agents for GDPR, ISO 27001, SOC 2, HIPAA, EU AI Act, DORA, NIS2 and more"
        }
      ],
      "summary": "27 compliance agents + 11 workflows across 26+ frameworks.",
      "desc": "GRC compliance (26 frameworks)",
      "description": "GRC compliance (26 frameworks)"
    },
    "seo": {
      "id": "seo",
      "order": 4,
      "name": "SEO",
      "displayName": "SEO Audit 360",
      "iconEmoji": "🔍",
      "required": false,
      "installerAgentCount": 3,
      "categoryAgentCount": 0,
      "agentCount": 3,
      "subAgentCount": 0,
      "workflowCount": 0,
      "frameworkCount": 1,
      "categoryCount": 0,
      "skillCount": 0,
      "referenceFiles": 0,
      "categoryAgentCounts": [],
      "runtimes": [
        "node",
        "python"
      ],
      "requiredResources": [
        ".agents/skills/pack-seo/seo-scout.md",
        ".agents/skills/pack-seo/seo-chief.md",
        ".agents/skills/pack-seo/seo-judge.md",
        ".agents/skills/pack-seo/SKILL.md",
        ".agents/skills/pack-seo/scripts/seo_fetch.py"
      ],
      "personas": [
        {
          "id": "seo-scout",
          "name": "SEO Scout",
          "role": "Technical Scanner",
          "description": "Crawling + technical inspection + performance"
        },
        {
          "id": "seo-chief",
          "name": "SEO Chief",
          "role": "Strategist & Reporter",
          "description": "Scoring + strategy + reporting"
        },
        {
          "id": "seo-judge",
          "name": "SEO Judge",
          "role": "Content & AI Analyst",
          "description": "Content quality + structured data + GEO analysis"
        }
      ],
      "summary": "3 agents (Scout, Chief, Judge) + 6-phase audit + PageSpeed loop.",
      "desc": "SEO audit & optimization",
      "description": "SEO audit & optimization"
    },
    "memory": {
      "id": "memory",
      "order": 5,
      "name": "Memory",
      "displayName": "Memory — Persistent Brain",
      "iconEmoji": "🧠",
      "required": false,
      "installerAgentCount": 1,
      "categoryAgentCount": 0,
      "agentCount": 1,
      "subAgentCount": 0,
      "workflowCount": 0,
      "frameworkCount": 0,
      "categoryCount": 0,
      "skillCount": 0,
      "referenceFiles": 0,
      "categoryAgentCounts": [],
      "runtimes": [
        "node"
      ],
      "requiredResources": [
        ".agents/skills/pack-memory/zecher-agent.md",
        ".agents/skills/pack-memory/memory-orchestrator.md"
      ],
      "personas": [
        {
          "id": "zecher",
          "name": "Zecher",
          "role": "Memory Archivist",
          "description": "Persistent cross-session memory, consolidation, project scanning, context recall, session handoffs",
          "alias": "זכר, Memory Guardian"
        }
      ],
      "summary": "Cross-session memory + project scanner + Karpathy guardrails.",
      "desc": "Persistent cross-session memory",
      "description": "Persistent cross-session memory"
    },
    "dev-studio": {
      "id": "dev-studio",
      "order": 6,
      "name": "Dev Studio",
      "displayName": "Dev Studio — Full SDLC",
      "iconEmoji": "🏗️",
      "required": false,
      "installerAgentCount": 1,
      "categoryAgentCount": 0,
      "agentCount": 6,
      "subAgentCount": 6,
      "workflowCount": 38,
      "frameworkCount": 0,
      "categoryCount": 5,
      "skillCount": 1,
      "referenceFiles": 0,
      "categoryAgentCounts": [
        0,
        0,
        0,
        0,
        0
      ],
      "runtimes": [
        "node"
      ],
      "requiredResources": [
        ".agents/skills/pack-dev-studio/dev-studio-orchestrator.md",
        ".agents/skills/dev-studio/SKILL.md",
        ".agents/skills/pack-dev-studio/SKILL.md",
        ".agents/skills/pack-dev-studio/shared/catalog.json",
        ".agents/skills/pack-dev-studio/shared/execution.md",
        ".agents/skills/pack-dev-studio/categories/planning/create-ux-design.md",
        ".agents/skills/pack-dev-studio/categories/planning/steps/step-01-init.md"
      ],
      "personas": [
        {
          "id": "analyst-agent",
          "name": "Miriam",
          "role": "Business Analyst",
          "description": "Strategic analysis, research, product briefs",
          "alias": "מרים"
        },
        {
          "id": "tech-writer-agent",
          "name": "Huldah",
          "role": "Technical Writer",
          "description": "Documentation, diagrams, editorial review",
          "alias": "חולדה"
        },
        {
          "id": "pm-agent",
          "name": "Yosef",
          "role": "Product Manager",
          "description": "PRD, requirements, feature prioritization",
          "alias": "יוסף"
        },
        {
          "id": "ux-designer-agent",
          "name": "Rachel",
          "role": "UX Designer",
          "description": "User experience, wireframes, empathy mapping",
          "alias": "רחל"
        },
        {
          "id": "architect-agent",
          "name": "Bezalel",
          "role": "System Architect",
          "description": "Architecture, ADRs, epics & stories",
          "alias": "בצלאל"
        },
        {
          "id": "dev-agent",
          "name": "Oholiab",
          "role": "Senior Engineer",
          "description": "TDD, sprint, code review, implementation",
          "alias": "אהליאב"
        }
      ],
      "summary": "6 specialized agents + 38 workflows: Analysis → Planning → Architecture → Implementation → Review.",
      "desc": "SDLC automation (6 agents, specialized workflows)",
      "description": "SDLC automation (6 agents, specialized workflows)"
    },
    "backup": {
      "id": "backup",
      "order": 7,
      "name": "Backup",
      "displayName": "Universal Backup",
      "iconEmoji": "🗂️",
      "required": false,
      "installerAgentCount": 1,
      "categoryAgentCount": 0,
      "agentCount": 1,
      "subAgentCount": 0,
      "workflowCount": 0,
      "frameworkCount": 0,
      "categoryCount": 0,
      "skillCount": 0,
      "referenceFiles": 0,
      "categoryAgentCounts": [],
      "runtimes": [
        "node"
      ],
      "requiredResources": [
        ".agents/skills/pack-backup/backup-agent.md"
      ],
      "personas": [
        {
          "id": "backup-agent",
          "name": "Backup Manager",
          "role": "Backup & Restore",
          "description": "Timestamped backups, restoration, and rotation"
        }
      ],
      "summary": "Timestamped ZIP backup with smart exclusions.",
      "desc": "Backup & restore",
      "description": "Backup & restore"
    },
    "animated": {
      "id": "animated",
      "order": 8,
      "name": "Animated",
      "displayName": "Animated Website",
      "iconEmoji": "🎬",
      "required": false,
      "installerAgentCount": 1,
      "categoryAgentCount": 0,
      "agentCount": 1,
      "subAgentCount": 0,
      "workflowCount": 0,
      "frameworkCount": 0,
      "categoryCount": 0,
      "skillCount": 0,
      "referenceFiles": 0,
      "categoryAgentCounts": [],
      "runtimes": [
        "node"
      ],
      "requiredResources": [
        ".agents/skills/pack-animated/animated-website-agent.md"
      ],
      "personas": [
        {
          "id": "animated-website-agent",
          "name": "Animated Website Creator",
          "role": "Website Builder",
          "description": "Video-driven scrolling websites"
        }
      ],
      "summary": "Luxury scroll-driven website from video.",
      "desc": "Animated website agents",
      "description": "Animated website agents"
    }
  },
  "pythonPacks": {
    "seo": {
      "requirements": [
        "src",
        "bmad-plus",
        "packs",
        "pack-seo",
        "requirements.txt"
      ],
      "verifyModules": [
        "requests",
        "bs4",
        "defusedxml",
        "lxml"
      ]
    }
  },
  "diagnostics": {
    "schemaVersion": 1,
    "processExecution": {
      "adapters": [
        "command",
        "codex-exec"
      ],
      "supervisor": "foreground",
      "launch": "explicit-plan",
      "collect": "exact-attempt-receipt",
      "cancellation": "original-owner-direct-child",
      "verification": "independent-required",
      "scheduling": "none"
    },
    "runtimeMinimums": {
      "node": "20.0.0",
      "python": "3.11"
    },
    "integrations": {
      "claude-code": {
        "instructionFile": "CLAUDE.md",
        "execution": "host-managed",
        "lifecycleEvents": "not-integrated"
      },
      "gemini-cli": {
        "instructionFile": "GEMINI.md",
        "execution": "host-managed",
        "lifecycleEvents": "not-integrated"
      },
      "antigravity": {
        "instructionFile": "GEMINI.md",
        "execution": "host-managed",
        "lifecycleEvents": "not-integrated"
      },
      "cursor": {
        "instructionFile": ".cursor/rules/bmad-plus.mdc",
        "execution": "host-managed",
        "lifecycleEvents": "not-integrated"
      },
      "codex-cli": {
        "instructionFile": ".codex/AGENTS.md",
        "execution": "host-managed",
        "lifecycleEvents": "not-integrated"
      },
      "opencode": {
        "instructionFile": ".opencode/AGENTS.md",
        "execution": "host-managed",
        "lifecycleEvents": "not-integrated"
      },
      "aider": {
        "instructionFile": "CONVENTIONS.md",
        "execution": "host-managed",
        "lifecycleEvents": "not-integrated"
      }
    }
  },
  "targets": {
    "spine": "AGENTS.md",
    "adapters": [
      {
        "tool": "claude-code",
        "file": "CLAUDE.md"
      },
      {
        "tool": "gemini-cli",
        "file": "GEMINI.md"
      },
      {
        "tool": "antigravity",
        "file": "GEMINI.md"
      },
      {
        "tool": "cursor",
        "file": ".cursor/rules/bmad-plus.mdc"
      },
      {
        "tool": "codex-cli",
        "file": ".codex/AGENTS.md"
      },
      {
        "tool": "opencode",
        "file": ".opencode/AGENTS.md"
      },
      {
        "tool": "aider",
        "file": "CONVENTIONS.md"
      }
    ],
    "models_supported": [
      "claude",
      "gpt",
      "gemini",
      "local"
    ]
  }
};

module.exports = { PACKS, PACK_ORDER, EXPECTED_AGENTS, DERIVED };
