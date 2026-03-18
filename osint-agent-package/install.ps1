# OSINT Agent — Installation Script (Windows PowerShell)
# Usage: .\install.ps1 [-ProjectRoot "path\to\bmad\project"]

param(
    [string]$ProjectRoot = "."
)

$ErrorActionPreference = "Stop"
$PackageDir = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " OSINT Agent Installer for BMAD" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Resolve project root
$ProjectRoot = Resolve-Path $ProjectRoot
Write-Host "Project root: $ProjectRoot" -ForegroundColor Yellow

# Verify BMAD is installed
$bmadDir = Join-Path $ProjectRoot "_bmad\bmm\agents"
if (-not (Test-Path $bmadDir)) {
    Write-Host "ERROR: BMAD not found at $bmadDir" -ForegroundColor Red
    Write-Host "Make sure BMAD Method is installed in the target project." -ForegroundColor Red
    Write-Host "Run: npx bmad-method install" -ForegroundColor Yellow
    exit 1
}
Write-Host "  BMAD found" -ForegroundColor Green

# Verify Python
$python = Get-Command python -ErrorAction SilentlyContinue
if (-not $python) {
    Write-Host "ERROR: Python not found. Install Python 3.10+" -ForegroundColor Red
    exit 1
}
Write-Host "  Python found: $($python.Source)" -ForegroundColor Green

# 1. Copy agent definition
Write-Host ""
Write-Host "1. Installing agent definition..." -ForegroundColor Cyan
$agentSrc = Join-Path $PackageDir "agents\osint-investigator.md"
$agentDst = Join-Path $ProjectRoot "_bmad\bmm\agents\osint-investigator.md"
Copy-Item $agentSrc $agentDst -Force
Write-Host "   -> $agentDst" -ForegroundColor Green

# 2. Copy skills
Write-Host ""
Write-Host "2. Installing skills..." -ForegroundColor Cyan

$skillsDir = Join-Path $ProjectRoot ".agents\skills"

# Skill 1: Agent entry point
$skill1Dst = Join-Path $skillsDir "bmad-osint-investigator"
New-Item -ItemType Directory -Force -Path $skill1Dst | Out-Null
Copy-Item (Join-Path $PackageDir "skills\bmad-osint-investigator\SKILL.md") $skill1Dst -Force
Write-Host "   -> bmad-osint-investigator/SKILL.md" -ForegroundColor Green

# Skill 2: Investigation pipeline + scripts
$skill2Dst = Join-Path $skillsDir "bmad-osint-investigate"
New-Item -ItemType Directory -Force -Path $skill2Dst | Out-Null
Copy-Item (Join-Path $PackageDir "skills\bmad-osint-investigate\SKILL.md") $skill2Dst -Force

$osintDst = Join-Path $skill2Dst "osint"
New-Item -ItemType Directory -Force -Path "$osintDst\scripts", "$osintDst\references", "$osintDst\assets" | Out-Null

Copy-Item (Join-Path $PackageDir "skills\bmad-osint-investigate\osint\SKILL.md") $osintDst -Force
Copy-Item (Join-Path $PackageDir "skills\bmad-osint-investigate\osint\scripts\*") "$osintDst\scripts\" -Force
Copy-Item (Join-Path $PackageDir "skills\bmad-osint-investigate\osint\references\*") "$osintDst\references\" -Force
Copy-Item (Join-Path $PackageDir "skills\bmad-osint-investigate\osint\assets\*") "$osintDst\assets\" -Force
Write-Host "   -> bmad-osint-investigate/ (full pipeline + scripts)" -ForegroundColor Green

# 3. Run diagnostic
Write-Host ""
Write-Host "3. Running diagnostic..." -ForegroundColor Cyan
$diagScript = Join-Path $osintDst "scripts\diagnose.py"
& python $diagScript

# 4. Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Installation complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  1. Configure API keys - see SETUP_KEYS.md"
Write-Host "  2. Invoke 'bmad-osint-investigator' skill in your AI agent"
Write-Host ""
