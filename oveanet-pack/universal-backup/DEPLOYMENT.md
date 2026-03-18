# 🚀 Guide de déploiement — Universal Backup Agent

## Méthode 1 : Intégration BMAD (recommandée)

### Étape 1 — Copier l'agent
Copier `agent/backup-agent.md` dans le dossier agents de votre projet BMAD :
```
votre-projet/
├── _bmad/
│   └── agents/
│       └── backup-agent.md    ← copier ici
```

### Étape 2 — Déclarer dans le manifest
Ajouter cette ligne dans `_bmad_config/agent-manifest.csv` :
```csv
backup-agent,Universal Backup Manager,backup,Gère les sauvegardes ZIP horodatées du projet,_bmad/agents/backup-agent.md
```

### Étape 3 — Ajouter le workflow Gemini
Copier `templates/backup-workflow.md` dans :
```
votre-projet/.agent/workflows/backup-project.md
```
**Important :** Remplacer `%PROJECT_ROOT%` par le chemin réel du projet.

---

## Méthode 2 : Standalone (sans BMAD)

### Option A — Workflow Gemini uniquement
1. Créer `.agent/workflows/` dans votre projet
2. Copier `templates/backup-workflow.md` → `.agent/workflows/backup-project.md`
3. Remplacer `%PROJECT_ROOT%` par le chemin réel
4. Utiliser avec `/backup-project`

### Option B — Commande directe
Coller cette commande dans votre terminal :

**Windows :**
```powershell
$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$projectRoot = "C:\chemin\vers\votre\projet"
$projectName = Split-Path $projectRoot -Leaf
$backupDir = "$projectRoot\backups"
if (!(Test-Path $backupDir)) { New-Item -ItemType Directory -Path $backupDir -Force }
Get-ChildItem $projectRoot -Exclude "backups","node_modules",".git","vendor","__pycache__" |
  Compress-Archive -DestinationPath "$backupDir\${projectName}_backup_$timestamp.zip" -Force
```

**Linux/Mac :**
```bash
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PROJECT_ROOT="/chemin/vers/votre/projet"
PROJECT_NAME=$(basename "$PROJECT_ROOT")
mkdir -p "$PROJECT_ROOT/backups"
cd "$PROJECT_ROOT" && zip -r "backups/${PROJECT_NAME}_backup_$TIMESTAMP.zip" . \
  -x "backups/*" "node_modules/*" ".git/*" "vendor/*" "__pycache__/*"
```

---

## 📁 Exclusions par défaut

| Dossier/Pattern | Raison |
|----------------|--------|
| `backups/` | Éviter la récursion |
| `node_modules/` | Dépendances, se réinstallent avec `npm install` |
| `.git/` | Historique Git, lourd et inutile dans un backup |
| `vendor/` | Dépendances PHP/Composer |
| `__pycache__/` | Cache Python compilé |
| `*.backup_*` | Anciens fichiers de backup individuels |

## 🔧 Personnalisation

Pour exclure d'autres dossiers, ajoutez-les à la liste `Exclude` :
```powershell
# Exemple: exclure aussi "storage" et "tmp"
Get-ChildItem $projectRoot -Exclude "backups","node_modules",".git","vendor","__pycache__","storage","tmp"
```
