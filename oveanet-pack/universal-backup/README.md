# 🗂️ Universal Project Backup Agent

Agent BMAD universel pour créer des backups ZIP horodatés de n'importe quel projet web.

## 📁 Structure

```
Universal Backup Agent/
├── agent/
│   └── backup-agent.md          # Agent BMAD
├── templates/
│   └── backup-workflow.md       # Workflow Gemini prêt à copier
├── README.md                    # Ce fichier
└── DEPLOYMENT.md                # Guide de déploiement
```

## 🚀 Utilisation rapide

### Commande slash
```
/backup-project
```

### Commande manuelle (PowerShell)
```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$projectRoot = "CHEMIN_DU_PROJET"
$backupDir = "$projectRoot\backups"
if (!(Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force }
Get-ChildItem $projectRoot -Exclude "backups","node_modules",".git","vendor","__pycache__","*.backup_*" |
  Compress-Archive -DestinationPath "$backupDir\backup_$timestamp.zip" -Force
```

### Commande manuelle (Bash/Linux)
```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PROJECT_ROOT="CHEMIN_DU_PROJET" 
mkdir -p "$PROJECT_ROOT/backups"
cd "$PROJECT_ROOT" && zip -r "backups/backup_$TIMESTAMP.zip" . \
  -x "backups/*" "node_modules/*" ".git/*" "vendor/*" "__pycache__/*" "*.backup_*"
```

## ⚙️ Fonctionnalités

- **Horodatage automatique** : chaque backup est nommé avec date + heure
- **Exclusions intelligentes** : ignore `node_modules`, `.git`, `vendor`, `backups/`, `__pycache__`
- **Multi-plateforme** : PowerShell (Windows) et Bash (Linux/Mac)
- **Compatible BMAD** : intégrable comme agent dans le framework BMAD
- **Workflow Gemini** : fichier `.md` prêt à copier dans `.agent/workflows/`

## 📋 Projets compatibles

Fonctionne avec tout type de projet :
- PHP / Laravel / Symfony
- Node.js / Next.js / Vite
- Python / Django / Flask
- HTML/CSS/JS statique
- WordPress / CMS
