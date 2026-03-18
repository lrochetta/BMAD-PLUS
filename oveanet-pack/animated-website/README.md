# 🎬 Animated Website Agent

Agent pour créer des sites web animés de luxe à partir de vidéos MP4, avec animation scroll frame-by-frame style Apple.

## 📁 Structure

```
Animated Website Agent/
├── README.md                          # Ce fichier
├── DEPLOYMENT.md                      # Guide de déploiement
├── agent/
│   └── animated-website-agent.md      # Agent complet
├── scripts/
│   └── extract_frames.py             # Script d'extraction de frames
└── templates/
    └── animated-website-workflow.md   # Workflow Gemini
```

## 🎯 Cas d'usage

- **Showcase immobilier** — visite virtuelle d'une propriété avec scroll
- **Lancement produit** — page style Apple avec défilement cinématique
- **Portfolio créatif** — présentation d'œuvres avec animation fluide
- **Automobiles** — dévoilement de véhicule au scroll
- **Restaurants/Hôtels** — expérience de marque immersive

## 🚀 Fonctionnalités

| Feature | Description |
|---------|-------------|
| **Canvas Frame Animation** | Vidéo jouée frame par frame au scroll |
| **Scroll Dwell Engine** | Ralentissements naturels aux sections clés |
| **Ambient Particles** | 40+ particules animées en arrière-plan |
| **Film Grain** | Texture cinématique SVG (3.5% opacité) |
| **Glass Morphism** | Cartes avec backdrop-blur et transparence |
| **Letter-Split Animations** | Titres qui apparaissent lettre par lettre |
| **Parallax Gallery** | Galerie masonry avec effets parallax |
| **Custom Cursor** | Curseur design avec ring animé (desktop) |
| **Chapter Markers** | Navigation verticale avec dots de progression |
| **Branded Loader** | Écran de chargement avec barre animée |

## ⚠️ Prérequis

- **FFmpeg** + **FFprobe** (extraction et conversion vidéo)
- **Python 3** (script d'extraction)
- **Pillow** (si FFmpeg n'a pas libwebp)

### Installation FFmpeg

**Windows :**
```powershell
winget install FFmpeg
```

**Mac :**
```bash
brew install ffmpeg
```

**Linux :**
```bash
sudo apt install ffmpeg
```
