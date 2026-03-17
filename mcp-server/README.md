# 🛡️ Audit 360 MCP Server

This server exposes secure tools (GitHub, Gamma) to Antigravity without exposing secrets.

## 📋 Prerequisites
- A Linux VPS (Ubuntu/Debian recommended) with Docker installed.
- **Secrets**:
  - `GITHUB_TOKEN`: Personal Access Token or App Key.
  - `GAMMA_API_KEY`: API Key for Gamma.app.
  - `MCP_AUDIT360_TOKEN`: A secret token you define (must match Antigravity config).

## 🚀 Deployment (One-Click)

1.  **Edit `.env` file** (create it inside `mcp-server/`):
    ```bash
    GITHUB_TOKEN=ghp_xxxx
    GAMMA_API_KEY=gamma_xxxx
    MCP_AUDIT360_TOKEN=my-secret-token
    ```

2.  **Run Deploy Script**:
    ```bash
    ./deploy-mcp.sh <VPS_IP_ADDRESS>
    ```

## 🔍 Validation
Once deployed, verify it's running:
```bash
curl http://<VPS_IP>:8000/health
```

Then configure Antigravity using `_bmad/bmm/data/templates/mcp-config.template.json`.
