---
description: Create a full ZIP backup of the current project
---

# Backup Project

Creates a timestamped ZIP archive of the entire project in a `backups/` folder at the project root.

## Auto-detect

The agent should:
1. Detect the project root from the active workspace
2. Detect the OS (PowerShell for Windows, Bash for Linux/Mac)
3. Name the backup using the project folder name

## Steps

// turbo-all

1. Create the backup ZIP archive:

### Windows (PowerShell)
```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$projectRoot = "%PROJECT_ROOT%"
$projectName = Split-Path $projectRoot -Leaf
$backupDir = "$projectRoot\backups"
if (!(Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force }
Get-ChildItem $projectRoot -Exclude "backups","node_modules",".git","vendor","__pycache__","*.backup_*" |
  Compress-Archive -DestinationPath "$backupDir\${projectName}_backup_$timestamp.zip" -Force
$size = (Get-Item "$backupDir\${projectName}_backup_$timestamp.zip").Length / 1MB
Write-Output "Backup: ${projectName}_backup_$timestamp.zip ($([math]::Round($size,2)) MB)"
```

### Linux/Mac (Bash)
```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PROJECT_ROOT="%PROJECT_ROOT%"
PROJECT_NAME=$(basename "$PROJECT_ROOT")
mkdir -p "$PROJECT_ROOT/backups"
cd "$PROJECT_ROOT" && zip -r "backups/${PROJECT_NAME}_backup_$TIMESTAMP.zip" . \
  -x "backups/*" "node_modules/*" ".git/*" "vendor/*" "__pycache__/*" "*.backup_*"
```

2. Confirm the backup was created and report the file name and size.

## Notes

- Replace `%PROJECT_ROOT%` with the actual project root path
- Excludes: `backups/`, `node_modules/`, `.git/`, `vendor/`, `__pycache__/`, `*.backup_*`
- Backups are stored in `{project}/backups/` with naming: `{project_name}_backup_YYYYMMDD_HHMMSS.zip`
