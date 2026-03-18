# 🚀 Guide de déploiement — Animated Website Agent

## Méthode 1 : Intégration BMAD (recommandée)

### Étape 1 — Copier l'agent et le script
```
votre-projet/
├── _bmad/
│   └── agents/
│       └── animated-website-agent.md    ← copier depuis agent/
└── scripts/
    └── extract_frames.py               ← copier depuis scripts/
```

### Étape 2 — Déclarer dans le manifest
Ajouter dans `_bmad_config/agent-manifest.csv` :
```csv
animated-website-agent,Animated Website Creator,web,Convertit des vidéos MP4 en sites web animés de luxe,_bmad/agents/animated-website-agent.md
```

### Étape 3 — Workflow Gemini (optionnel)
Copier `templates/animated-website-workflow.md` dans :
```
votre-projet/.agent/workflows/animated-website.md
```

---

## Méthode 2 : Standalone

### Option A — Agent Gemini
1. Créer `.agent/workflows/` dans votre projet
2. Copier `templates/animated-website-workflow.md`
3. Copier `scripts/extract_frames.py` dans votre projet
4. Utiliser avec `/animated-website`

### Option B — Manuel

#### 1. Installer les dépendances
```bash
# FFmpeg (requis)
winget install FFmpeg        # Windows
brew install ffmpeg          # Mac
sudo apt install ffmpeg      # Linux

# Pillow (fallback si FFmpeg n'a pas libwebp)
pip install Pillow
```

#### 2. Extraire les frames
```bash
python3 scripts/extract_frames.py \
  --input "video.mp4" \
  --output "output/frames" \
  --frames 120 \
  --quality 80
```

#### 3. Construire le site
Utiliser l'agent ou le guide dans `agent/animated-website-agent.md` pour générer le `index.html`.

#### 4. Prévisualiser
```bash
cd output/
python3 -m http.server 8080
# Ouvrir http://localhost:8080
```

---

## 📁 Structure de sortie

```
projet/
├── frames/
│   ├── desktop/        # 1920x1080 WebP
│   │   ├── frame-0001.webp
│   │   └── ...
│   ├── mobile/         # 960x540 WebP
│   │   ├── frame-0001.webp
│   │   └── ...
│   └── manifest.json   # Métadonnées
└── index.html          # Site complet (fichier unique)
```

## ⚙️ Options du script

| Option | Par défaut | Description |
|--------|-----------|-------------|
| `--input` | (requis) | Chemin de la vidéo MP4 |
| `--output` | (requis) | Dossier de sortie des frames |
| `--frames` | Auto | Nombre de frames (auto = durée × 10, max 200) |
| `--quality` | 80 | Qualité WebP (1-100) |
| `--desktop-res` | 1920x1080 | Résolution desktop |
| `--mobile-res` | 960x540 | Résolution mobile |
| `--desktop-only` | false | Ignorer les frames mobile |
| `--mobile-only` | false | Ignorer les frames desktop |

## 💡 Recommandations payload

| Type | Budget max | Si dépassé |
|------|-----------|------------|
| Desktop | 10 MB | `--quality 60` ou `--frames 90` |
| Mobile | 5 MB | `--quality 60` ou `--frames 90` |
