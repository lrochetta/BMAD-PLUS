#!/bin/bash
# BMAD+ SEO Engine — Dependency Installer (Linux/macOS)
# Author: Laurent Rochetta

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PARENT_DIR="$(dirname "$SCRIPT_DIR")"

echo "🔧 BMAD+ SEO Engine — Installing dependencies..."
echo ""

# Check Python
if command -v python3 &>/dev/null; then
    PYTHON=python3
elif command -v python &>/dev/null; then
    PYTHON=python
else
    echo "❌ Python not found. Please install Python 3.10+"
    exit 1
fi

echo "Using: $($PYTHON --version)"

# Create venv if not exists
if [ ! -d "$PARENT_DIR/.venv" ]; then
    echo "📦 Creating virtual environment..."
    $PYTHON -m venv "$PARENT_DIR/.venv"
fi

# Activate venv
source "$PARENT_DIR/.venv/bin/activate" 2>/dev/null || true

# Install core dependencies
echo "📥 Installing core dependencies..."
$PYTHON -m pip install --quiet -r "$PARENT_DIR/requirements.txt"

echo ""
echo "✅ Core dependencies installed!"
echo ""
echo "Optional: To enable screenshots (seo_screenshot.py):"
echo "  pip install playwright && playwright install chromium"
echo ""
echo "Set your Google API key for live data:"
echo "  export GOOGLE_API_KEY=your_key_here"
echo "  Get one free: https://console.cloud.google.com/apis/credentials"
echo ""
echo "🚀 Ready! — BMAD+ SEO Engine by Laurent Rochetta"
