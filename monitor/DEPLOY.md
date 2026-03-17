# BMAD+ Monitor — VPS Deployment Guide

> **Target:** VPS `89.167.54.204` (Ubuntu, 7.6 GB RAM)
> **Prérequis:** Docker déjà installé, MCP Server Audit 360° déjà en place sur port 8000
> **Objectif:** Déployer le système de monitoring upstream BMAD+ avec notifications WhatsApp

---

## Step 1: Clone le repo BMAD+ sur le VPS

```bash
cd /opt
git clone https://github.com/lrochetta/BMAD-PLUS.git bmad-plus
cd /opt/bmad-plus/monitor
```

> **Note:** Le repo est privé. Si git demande l'auth, utiliser le GITHUB_TOKEN disponible dans `/opt/mcp-server/.env` (variable `GITHUB_TOKEN`).
> Commande alternative:
> ```bash
> source /opt/mcp-server/.env
> git clone https://${GITHUB_TOKEN}@github.com/lrochetta/BMAD-PLUS.git /opt/bmad-plus
> ```

---

## Step 2: Installer les dépendances Python

```bash
cd /opt/bmad-plus/monitor
pip3 install requests pyyaml google-generativeai
```

---

## Step 3: Déployer Evolution API (WhatsApp)

```bash
cd /opt/bmad-plus/monitor

# Générer une API key sécurisée pour Evolution
export EVOLUTION_API_KEY=$(openssl rand -hex 32)
echo "Generated Evolution API Key: $EVOLUTION_API_KEY"
echo "EVOLUTION_API_KEY=$EVOLUTION_API_KEY" >> /opt/bmad-plus/monitor/.env

# Lancer le container
docker compose up -d

# Vérifier que le container tourne
docker ps | grep evolution
# Attendu: container "bmad-plus-evolution" en status "Up"

# Vérifier que l'API répond
sleep 10
curl -s http://localhost:8080/ | head -20
# Attendu: réponse JSON ou HTML de l'API
```

**Vérification santé:**
```bash
curl -s http://localhost:8080/ && echo "✅ Evolution API OK" || echo "❌ Evolution API not responding"
```

---

## Step 4: Créer l'instance WhatsApp

```bash
# Lire l'API key générée
source /opt/bmad-plus/monitor/.env

# Créer l'instance "bmad-monitor"
curl -X POST http://localhost:8080/instance/create \
  -H "Content-Type: application/json" \
  -H "apikey: $EVOLUTION_API_KEY" \
  -d '{
    "instanceName": "bmad-monitor",
    "qrcode": true,
    "integration": "WHATSAPP-BAILEYS"
  }'
```

> **⚠️ IMPORTANT:** Cette commande retourne un **QR code** (en base64 ou URL).
> L'utilisateur Laurent devra scanner ce QR code avec son WhatsApp pour lier l'instance.
> **Afficher le QR code** pour que Laurent puisse le scanner:
> ```bash
> curl -s http://localhost:8080/instance/connect/bmad-monitor \
>   -H "apikey: $EVOLUTION_API_KEY" | python3 -c "import sys,json; print(json.load(sys.stdin).get('qrcode',{}).get('base64','No QR'))"
> ```
> Alternative: Accéder à `http://89.167.54.204:8080` dans un navigateur pour voir le QR code via l'interface web.

---

## Step 5: Configurer le monitoring

```bash
cd /opt/bmad-plus/monitor

# Lire les variables existantes
source /opt/bmad-plus/monitor/.env
source /opt/mcp-server/.env 2>/dev/null

# Créer config.yaml à partir du template
cat > config.yaml << 'YAML'
# Gemini API pour analyse IA des diffs upstream
gemini_api_key: "REPLACE_WITH_GEMINI_API_KEY"

# WhatsApp via Evolution API (localhost car même VPS)
whatsapp:
  enabled: true
  evolution_api_url: "http://localhost:8080"
  api_key: "REPLACE_WITH_EVOLUTION_API_KEY"
  instance_name: "bmad-monitor"
  phone_number: "REPLACE_WITH_PHONE_NUMBER"

# Email fallback (optionnel)
# fallback_email:
#   smtp_host: "smtp.gmail.com"
#   smtp_port: 587
#   username: "email@gmail.com"
#   password: "app-password"
#   from_addr: "email@gmail.com"
#   to_addr: "email@gmail.com"

# MCP Bridge (utilise le MCP Server local pour les ops git/github)
mcp:
  mcp_url: "http://localhost:8000"
  mcp_token: "REPLACE_WITH_MCP_TOKEN"
YAML

echo "⚠️ Fichier config.yaml créé. Les valeurs suivantes doivent être remplies par Laurent:"
echo "  - gemini_api_key: sa clé API Gemini"
echo "  - whatsapp.api_key: $EVOLUTION_API_KEY (déjà générée ci-dessus)"
echo "  - whatsapp.phone_number: son numéro WhatsApp avec indicatif pays (ex: 41791234567)"
echo "  - mcp.mcp_token: le token MCP existant dans /opt/mcp-server/.env"
```

> **Note pour l'agent:** Si tu as accès aux variables d'environnement du MCP server, tu peux pré-remplir `mcp.mcp_token` avec la valeur de `MCP_AUDIT360_TOKEN` et `whatsapp.api_key` avec `$EVOLUTION_API_KEY`. La clé Gemini API et le numéro de téléphone devront être fournis par Laurent.

---

## Step 6: Tester la notification

```bash
cd /opt/bmad-plus/monitor

# Test du script (vérifie que tout est configuré)
python3 weekly-check.py --test
# Attendu: "Test notification sent via WhatsApp" + message reçu sur WhatsApp

# Si WhatsApp pas encore configuré, tester en dry-run:
python3 weekly-check.py --dry-run
# Attendu: rapport sur les changements upstream sans notification
```

---

## Step 7: Configurer le cron job

```bash
# Ajouter le cron pour exécution chaque lundi à 9h00
(crontab -l 2>/dev/null; echo "0 9 * * 1 cd /opt/bmad-plus/monitor && /usr/bin/python3 weekly-check.py >> /var/log/bmad-monitor.log 2>&1") | crontab -

# Vérifier que le cron est bien enregistré
crontab -l | grep bmad
# Attendu: "0 9 * * 1 cd /opt/bmad-plus/monitor && ..."

# Créer le fichier de log
touch /var/log/bmad-monitor.log
```

---

## Step 8: Vérification finale

```bash
echo "=== BMAD+ Monitor Deployment Check ==="

# 1. Evolution API
docker ps | grep -q evolution && echo "✅ Evolution API running" || echo "❌ Evolution API not running"

# 2. Config exists
[ -f /opt/bmad-plus/monitor/config.yaml ] && echo "✅ config.yaml present" || echo "❌ config.yaml missing"

# 3. Cron configured
crontab -l | grep -q bmad && echo "✅ Cron job set" || echo "❌ Cron not configured"

# 4. Python deps
python3 -c "import requests, yaml; print('✅ Python deps OK')" 2>/dev/null || echo "❌ Missing Python deps"

# 5. MCP Server still running
curl -s http://localhost:8000/api/info > /dev/null 2>&1 && echo "✅ MCP Server OK (not affected)" || echo "⚠️ MCP Server not responding"

# 6. Upstream access
git ls-remote https://github.com/bmad-code-org/BMAD-METHOD.git HEAD > /dev/null 2>&1 && echo "✅ Upstream accessible" || echo "❌ Cannot reach upstream"

echo "=== Done ==="
```

---

## Ports utilisés (résumé)

| Port | Service | Status |
|------|---------|--------|
| 8000 | MCP Server Audit 360° | **Existant — NE PAS TOUCHER** |
| 8080 | Evolution API (WhatsApp) | **Nouveau** |

## Fichiers créés

| Chemin | Contenu |
|--------|---------|
| `/opt/bmad-plus/` | Clone du repo BMAD-PLUS |
| `/opt/bmad-plus/monitor/config.yaml` | Configuration (secrets) |
| `/opt/bmad-plus/monitor/.env` | Evolution API key |
| `/var/log/bmad-monitor.log` | Log du cron |

## Ce qui reste à faire manuellement par Laurent

1. **Scanner le QR code WhatsApp** (Step 4)
2. **Fournir sa clé Gemini API** pour remplir `config.yaml`
3. **Fournir son numéro WhatsApp** avec indicatif pays
