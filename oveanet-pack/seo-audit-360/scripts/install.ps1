# BMAD+ SEO Engine — Dependency Installer (Windows)
# Author: Laurent Rochetta

$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ParentDir = Split-Path -Parent $ScriptDir

Write-Host "🔧 BMAD+ SEO Engine — Installing dependencies..." -ForegroundColor Cyan
Write-Host ""

# Check Python
$Python = $null
if (Get-Command python -ErrorAction SilentlyContinue) {
    $Python = "python"
} elseif (Get-Command py -ErrorAction SilentlyContinue) {
    $Python = "py -3"
} else {
    Write-Host "❌ Python not found. Please install Python 3.10+" -ForegroundColor Red
    exit 1
}

Write-Host "Using: $(& $Python --version)"

# Create venv if not exists
$VenvPath = Join-Path $ParentDir ".venv"
if (-not (Test-Path $VenvPath)) {
    Write-Host "📦 Creating virtual environment..."
    & $Python -m venv $VenvPath
}

# Activate venv
$ActivateScript = Join-Path $VenvPath "Scripts\Activate.ps1"
if (Test-Path $ActivateScript) {
    & $ActivateScript
}

# Install dependencies
Write-Host "📥 Installing core dependencies..."
$RequirementsPath = Join-Path $ParentDir "requirements.txt"
& $Python -m pip install --quiet -r $RequirementsPath

Write-Host ""
Write-Host "✅ Core dependencies installed!" -ForegroundColor Green
Write-Host ""
Write-Host "Optional: To enable screenshots (seo_screenshot.py):"
Write-Host "  pip install playwright; playwright install chromium"
Write-Host ""
Write-Host "Set your Google API key for live data:"
Write-Host '  $env:GOOGLE_API_KEY = "your_key_here"'
Write-Host "  Get one free: https://console.cloud.google.com/apis/credentials"
Write-Host ""
Write-Host "🚀 Ready! — BMAD+ SEO Engine by Laurent Rochetta" -ForegroundColor Cyan
