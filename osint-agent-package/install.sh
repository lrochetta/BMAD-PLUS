#!/bin/bash
# OSINT Agent — Installation Script (macOS/Linux)
# Usage: ./install.sh [project_root]

set -euo pipefail

PROJECT_ROOT="${1:-.}"
PACKAGE_DIR="$(cd "$(dirname "$0")" && pwd)"

echo "========================================"
echo " OSINT Agent Installer for BMAD"
echo "========================================"
echo ""

# Resolve project root
PROJECT_ROOT="$(cd "$PROJECT_ROOT" && pwd)"
echo "Project root: $PROJECT_ROOT"

# Verify BMAD
BMAD_DIR="$PROJECT_ROOT/_bmad/bmm/agents"
if [ ! -d "$BMAD_DIR" ]; then
    echo "ERROR: BMAD not found at $BMAD_DIR"
    echo "Run: npx bmad-method install"
    exit 1
fi
echo "  ✅ BMAD found"

# Verify Python
if ! command -v python3 &>/dev/null; then
    echo "ERROR: Python3 not found. Install Python 3.10+"
    exit 1
fi
echo "  ✅ Python found: $(python3 --version)"

# 1. Copy agent definition
echo ""
echo "1. Installing agent definition..."
cp "$PACKAGE_DIR/agents/osint-investigator.md" "$BMAD_DIR/"
echo "   → osint-investigator.md"

# 2. Copy skills
echo ""
echo "2. Installing skills..."
SKILLS_DIR="$PROJECT_ROOT/.agents/skills"

mkdir -p "$SKILLS_DIR/bmad-osint-investigator"
cp "$PACKAGE_DIR/skills/bmad-osint-investigator/SKILL.md" "$SKILLS_DIR/bmad-osint-investigator/"
echo "   → bmad-osint-investigator/"

mkdir -p "$SKILLS_DIR/bmad-osint-investigate/osint/scripts"
mkdir -p "$SKILLS_DIR/bmad-osint-investigate/osint/references"
mkdir -p "$SKILLS_DIR/bmad-osint-investigate/osint/assets"
cp "$PACKAGE_DIR/skills/bmad-osint-investigate/SKILL.md" "$SKILLS_DIR/bmad-osint-investigate/"
cp "$PACKAGE_DIR/skills/bmad-osint-investigate/osint/SKILL.md" "$SKILLS_DIR/bmad-osint-investigate/osint/"
cp "$PACKAGE_DIR/skills/bmad-osint-investigate/osint/scripts/"*.py "$SKILLS_DIR/bmad-osint-investigate/osint/scripts/"
cp "$PACKAGE_DIR/skills/bmad-osint-investigate/osint/references/"* "$SKILLS_DIR/bmad-osint-investigate/osint/references/"
cp "$PACKAGE_DIR/skills/bmad-osint-investigate/osint/assets/"* "$SKILLS_DIR/bmad-osint-investigate/osint/assets/"
echo "   → bmad-osint-investigate/ (full pipeline + scripts)"

# 3. Make scripts executable
chmod +x "$SKILLS_DIR/bmad-osint-investigate/osint/scripts/"*.py

# 4. Run diagnostic
echo ""
echo "3. Running diagnostic..."
python3 "$SKILLS_DIR/bmad-osint-investigate/osint/scripts/diagnose.py"

# 5. Summary
echo ""
echo "========================================"
echo " ✅ Installation complete!"
echo "========================================"
echo ""
echo "Next steps:"
echo "  1. Configure API keys - see SETUP_KEYS.md"
echo "  2. Invoke 'bmad-osint-investigator' skill in your AI agent"
