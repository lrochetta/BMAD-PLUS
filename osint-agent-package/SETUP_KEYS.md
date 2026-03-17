# 🔑 Configuration des Clés API

Ce guide explique comment configurer les clés API pour l'agent OSINT.  
**Tu n'as besoin que d'UNE SEULE clé pour démarrer.** Plus tu en configures, plus l'agent est puissant.

---

## Clés API par priorité

### 🥇 Essentielles (au moins 1 requise)

#### JINA_API_KEY ⭐ Recommandée pour commencer
- **Gratuit** : 1 million de tokens à l'inscription
- **Coût** : ~$0.005/requête (search), ~$0.05 (deep)
- **Fonctions** : Recherche web, lecture d'URLs, deep search
- **Inscription** : https://jina.ai/api-key
```powershell
# Windows (permanent)
[System.Environment]::SetEnvironmentVariable("JINA_API_KEY", "jina_xxxx", "User")
# Session uniquement
$env:JINA_API_KEY = "jina_xxxx"
```
```bash
# macOS/Linux
echo 'export JINA_API_KEY="jina_xxxx"' >> ~/.bashrc
source ~/.bashrc
```

#### APIFY_API_TOKEN ⭐ Pour le scraping social
- **Gratuit** : $5/mois de crédits offerts
- **Fonctions** : LinkedIn, Instagram, Facebook, TikTok, YouTube, Google Maps (55+ scrapers)
- **Inscription** : https://console.apify.com/account/integrations
```powershell
[System.Environment]::SetEnvironmentVariable("APIFY_API_TOKEN", "apify_api_xxxx", "User")
```
```bash
echo 'export APIFY_API_TOKEN="apify_api_xxxx"' >> ~/.bashrc
```

---

### 🥈 Recommandées (améliorent les résultats)

#### PERPLEXITY_API_KEY
- **Coût** : $0.005/requête (sonar), $0.05 (deep research)
- **Fonctions** : Recherche IA avec citations, deep research
- **Inscription** : https://perplexity.ai/settings/api
```powershell
[System.Environment]::SetEnvironmentVariable("PERPLEXITY_API_KEY", "pplx-xxxx", "User")
```

#### TAVILY_API_KEY
- **Gratuit** : 1000 requêtes/mois
- **Fonctions** : Recherche optimisée pour agents IA, extraction de contenu
- **Inscription** : https://app.tavily.com/home
```powershell
[System.Environment]::SetEnvironmentVariable("TAVILY_API_KEY", "tvly-xxxx", "User")
```

#### EXA_API_KEY
- **Gratuit** : 1000 requêtes/mois
- **Fonctions** : Recherche sémantique, recherche de personnes/entreprises
- **Inscription** : https://dashboard.exa.ai
```powershell
[System.Environment]::SetEnvironmentVariable("EXA_API_KEY", "exa-xxxx", "User")
```

---

### 🥉 Optionnelles (pour aller plus loin)

#### PARALLEL_API_KEY
- **Gratuit** : Offre de lancement
- **Fonctions** : Recherche IA, extraction de pages complexes (JS, PDF)
- **Inscription** : https://platform.parallel.ai
```powershell
[System.Environment]::SetEnvironmentVariable("PARALLEL_API_KEY", "xxxx", "User")
```

#### BRIGHTDATA_MCP_URL
- **Payant** : ~$0.01/requête
- **Fonctions** : Scraping avec bypass CAPTCHA, Yandex, recherche géolocalisée
- **Inscription** : https://brightdata.com/products/web-scraper/mcp
```powershell
[System.Environment]::SetEnvironmentVariable("BRIGHTDATA_MCP_URL", "https://mcp.brightdata.com/xxxx", "User")
```

---

## Résumé des coûts

| API | Plan gratuit | Coût par investigation |
|-----|-------------|----------------------|
| Jina | 1M tokens | ~$0.03-0.05 |
| Apify | $5/mois | ~$0.01-0.10 |
| Tavily | 1000 req/mois | ~$0.005-0.01 |
| Exa | 1000 req/mois | ~$0.01-0.03 |
| Perplexity | Pay-as-you-go | ~$0.01-0.05 |
| **Total par investigation** | | **~$0.05-0.30** |

## Vérification

Après avoir configuré tes clés, **redémarre ton terminal** puis lance le diagnostic :
```
python skills/bmad-osint-investigate/osint/scripts/diagnose.py
```

Tu devrais voir tes clés avec un ✅ dans la section "API Tokens".
