"""
Audit 360° MCP Server v2.0
==========================
Modular MCP server with 35+ tools for Git Ops, GitHub, Gamma Reports,
RAG Knowledge Base, Audit Engine, CI/CD, and Orchestration.

Deployed on VPS: http://89.167.54.204:8000/sse

**IMPORTANT — HTTPS REQUIRED FOR PRODUCTION**
This server MUST be served over HTTPS in any production or staging environment.
Never expose the MCP server or its dashboard over plain HTTP outside localhost.
See the `if __name__ == "__main__"` block below for TLS configuration options.
"""
import logging
import os
import subprocess
from pathlib import Path

# --- Paths ---
BASE_DIR = Path(__file__).resolve().parent

# --- Logging ---
logger = logging.getLogger(__name__)

# --- Configuration ---
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GAMMA_API_KEY = os.getenv("GAMMA_API_KEY")
MCP_TOKEN = os.getenv("MCP_AUDIT360_TOKEN")
VPS_HOST = os.getenv("VPS_HOST", "localhost:8000")
VPS_HOSTNAME = VPS_HOST.split(":")[0]

if not all([GITHUB_TOKEN, GAMMA_API_KEY, MCP_TOKEN]):
    raise ValueError("Missing required environment variables: GITHUB_TOKEN, GAMMA_API_KEY, MCP_AUDIT360_TOKEN")

# Dashboard credentials required at startup
DASHBOARD_USER = os.getenv("DASHBOARD_USER", "admin")
DASHBOARD_PASS = os.getenv("DASHBOARD_PASS")
if not DASHBOARD_PASS:
    raise RuntimeError("DASHBOARD_PASS environment variable is required")

# --- Authentication ---
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

security_bearer = HTTPBearer(auto_error=False)


async def verify_mcp_token(credentials: HTTPAuthorizationCredentials = Depends(security_bearer)):
    if credentials is None or credentials.credentials != MCP_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or missing MCP token",
        )
    return credentials


# --- MCP Application ---
from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.server import TransportSecuritySettings

transport_security = TransportSecuritySettings(
    allowed_hosts=[VPS_HOSTNAME, VPS_HOST, "localhost", "127.0.0.1"],
    enable_dns_rebinding_protection=True
)
mcp = FastMCP("audit360-tools", transport_security=transport_security)


# --- RAG Startup (deferred to avoid import-time side effects) ---
def _start_rag_ingestion():
    """Trigger RAG knowledge base ingestion at startup if empty."""
    chroma_path = BASE_DIR / "chroma_db"
    ingest_script = BASE_DIR / "ingest.py"

    if not chroma_path.is_dir():
        logger.info("RAG: Knowledge Base directory missing. Triggering initial ingestion...")
    elif not any(chroma_path.iterdir()):
        logger.info("RAG: Knowledge Base empty. Triggering initial ingestion...")
    else:
        logger.info("RAG: Knowledge Base loaded.")
        return

    if not ingest_script.is_file():
        logger.error("RAG: ingest.py not found at %s. Cannot start background ingestion.", ingest_script)
        return

    try:
        proc = subprocess.Popen(
            ["python", str(ingest_script)],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
        )
        logger.info("RAG: Background ingestion started (PID %d)", proc.pid)
    except FileNotFoundError:
        logger.error("RAG: Python interpreter not found. Cannot start background ingestion.")
    except OSError as exc:
        logger.error("RAG: Failed to start background ingestion: %s", exc)


# --- Register All Tool Modules ---
from tools import git_ops, github_ops, gamma_report, rag_tools
from tools import audit_engine, ci_cd, orchestrator

git_ops.register(mcp)
github_ops.register(mcp)
gamma_report.register(mcp)
rag_tools.register(mcp)
audit_engine.register(mcp)
ci_cd.register(mcp)
orchestrator.register(mcp)

_tool_count = len(mcp._tool_manager.list_tools())
logger.info("Registered %d MCP tools across 7 modules", _tool_count)

# --- DASHBOARD EXTENSIONS ---
from starlette.responses import HTMLResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import base64
import json


# --- Basic Auth Middleware ---
class BasicAuthMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        if request.url.path.startswith("/dashboard") or request.url.path.startswith("/api"):
            auth_header = request.headers.get("Authorization")
            if not auth_header:
                return Response(status_code=401, headers={"WWW-Authenticate": "Basic"})

            try:
                scheme, credentials = auth_header.split()
                if scheme.lower() != 'basic':
                    return Response(status_code=401, headers={"WWW-Authenticate": "Basic"})

                decoded = base64.b64decode(credentials).decode("ascii")
                username, password = decoded.split(":", 1)

                if not DASHBOARD_PASS or username != DASHBOARD_USER or password != DASHBOARD_PASS:
                    return Response(status_code=401, headers={"WWW-Authenticate": "Basic"})
            except Exception:
                return Response(status_code=401, headers={"WWW-Authenticate": "Basic"})

        return await call_next(request)


# --- MCP Token Middleware ---
class MCPTokenCheckMiddleware(BaseHTTPMiddleware):
    """Verify Bearer token on MCP /sse and /messages/ routes."""
    async def dispatch(self, request: Request, call_next):
        if request.url.path in ("/sse",) or request.url.path.startswith("/messages"):
            auth_header = request.headers.get("Authorization")
            if not auth_header:
                logger.warning("MCP request without Authorization header: %s", request.url.path)
                return Response(
                    status_code=401,
                    content='{"error":"Missing Authorization header"}',
                    media_type="application/json",
                )

            try:
                scheme, token = auth_header.split()
                if scheme.lower() != 'bearer':
                    return Response(
                        status_code=401,
                        content='{"error":"Invalid authorization scheme"}',
                        media_type="application/json",
                    )
                if token != MCP_TOKEN:
                    logger.warning("Invalid MCP token attempt on %s", request.url.path)
                    return Response(
                        status_code=401,
                        content='{"error":"Invalid MCP token"}',
                        media_type="application/json",
                    )
            except Exception:
                return Response(
                    status_code=401,
                    content='{"error":"Invalid Authorization header"}',
                    media_type="application/json",
                )

        return await call_next(request)


# --- Dashboard Routes ---
async def dashboard(request):
    try:
        dashboard_path = BASE_DIR / "dashboard.html"
        if dashboard_path.exists():
            with open(dashboard_path, "r", encoding="utf-8") as f:
                return HTMLResponse(f.read())
        logger.warning("Dashboard HTML not found at %s", dashboard_path)
        return HTMLResponse("<h1>Dashboard HTML missing</h1>", status_code=404)
    except Exception as e:
        logger.error("Error serving dashboard: %s", e)
        return HTMLResponse(
            "<h1>Internal Server Error</h1><p>An unexpected error occurred. Check server logs.</p>",
            status_code=500,
        )


async def audit_api(request):
    """Legacy endpoint for latest audit"""
    try:
        audit_path = BASE_DIR / "latest_audit.json"
        if audit_path.exists():
            with open(audit_path, "r", encoding="utf-8") as f:
                return JSONResponse(json.load(f))
        return JSONResponse({"error": "No legacy audit data found"}, status_code=404)
    except Exception:
        logger.exception("Error reading legacy audit data")
        return JSONResponse({"error": "Error reading legacy data"}, status_code=500)


async def history_api(request):
    """List all available audits structured by Client/Project"""
    reports_dir = BASE_DIR / "reports"
    history = {}
    if not reports_dir.exists():
        return JSONResponse({})

    for client_dir in reports_dir.iterdir():
        if client_dir.is_dir():
            history[client_dir.name] = {}
            for project_dir in client_dir.iterdir():
                if project_dir.is_dir():
                    audits = [f.name for f in project_dir.glob("*_audit.json")]
                    history[client_dir.name][project_dir.name] = sorted(audits, reverse=True)

    return JSONResponse(history)


async def audit_detail_api(request):
    """Get specific audit data: /api/audit/{client}/{project}/{filename}"""
    client = request.path_params['client']
    project = request.path_params['project']
    filename = request.path_params['filename']

    # Security: sanitize path components — reject traversal attempts
    import re
    safe_pattern = re.compile(r'^[a-zA-Z0-9_][a-zA-Z0-9_.\-]*$')
    for param_name, param_val in [('client', client), ('project', project), ('filename', filename)]:
        if not safe_pattern.match(param_val):
            return JSONResponse({"error": f"Invalid {param_name}: contains forbidden characters"}, status_code=400)

    filepath = BASE_DIR / "reports" / client / project / filename

    try:
        resolved = filepath.resolve()
        resolved.relative_to((BASE_DIR / "reports").resolve())
    except ValueError:
        return JSONResponse({"error": "Invalid path"}, status_code=403)

    if resolved.exists():
        with open(resolved, "r", encoding="utf-8") as f:
            return JSONResponse(json.load(f))
    return JSONResponse({"error": "Audit not found"}, status_code=404)


async def server_info(request):
    """Server info endpoint — lists all registered tools."""
    tool_count = len(mcp._tool_manager.list_tools())
    return JSONResponse({
        "name": "Audit 360° MCP Server",
        "version": "2.0.0",
        "tools_count": tool_count,
        "modules": {
            "git_ops": 10,
            "github_ops": 7,
            "gamma_report": 5,
            "rag_tools": 4,
            "audit_engine": 4,
            "ci_cd": 4,
            "orchestrator": 1
        },
        "endpoints": {
            "sse": "/sse",
            "dashboard": "/dashboard",
            "api_audit": "/api/audit-latest",
            "api_history": "/api/history",
            "api_info": "/api/info"
        }
    })


# --- Main ---
if __name__ == "__main__":
    import uvicorn

    # Configure logging at module level on first run
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    # Trigger deferred startup tasks
    _start_rag_ingestion()

    # 1. Get Starlette App from FastMCP
    if hasattr(mcp, '_sse_app'):
        app = mcp._sse_app
    elif hasattr(mcp, 'sse_app'):
        app = mcp.sse_app()
    else:
        raise RuntimeError("Could not find ASGI app in FastMCP")

    # 2. Add Middleware (last added = outermost)
    app.add_middleware(BasicAuthMiddleware)
    app.add_middleware(MCPTokenCheckMiddleware)

    # 3. Add Routes
    app.add_route("/dashboard", dashboard, methods=["GET"])
    app.add_route("/api/audit-latest", audit_api, methods=["GET"])
    app.add_route("/api/history", history_api, methods=["GET"])
    app.add_route("/api/audit/{client}/{project}/{filename}", audit_detail_api, methods=["GET"])
    app.add_route("/api/info", server_info, methods=["GET"])

    logger.info("Audit 360° MCP Server v2.0 — %d tools, 7 modules", _tool_count)
    logger.info("SSE: http://127.0.0.1:8000/sse")
    logger.info("Dashboard: http://127.0.0.1:8000/dashboard")

    # 4. Run
    # =====================================================================
    # PRODUCTION TLS/HTTPS CONFIGURATION
    # =====================================================================
    # HTTPS is MANDATORY for any production or staging deployment. Choose
    # ONE of the following approaches:
    #
    # OPTION A — Reverse proxy (RECOMMENDED)
    #   Place this server behind Caddy or nginx which handles TLS
    #   termination and automatic certificate management.
    #
    #   --- Caddy (simplest, auto-HTTPS via Let's Encrypt) ---
    #     # Caddyfile
    #     audit360.example.com {
    #         reverse_proxy localhost:8000
    #     }
    #     Run: caddy run  (Caddy obtains & renews certs automatically)
    #
    #   --- nginx + Let's Encrypt (certbot) ---
    #     # /etc/nginx/sites-available/audit360
    #     server {
    #         listen 443 ssl;
    #         server_name audit360.example.com;
    #
    #         ssl_certificate     /etc/letsencrypt/live/audit360.example.com/fullchain.pem;
    #         ssl_certificate_key /etc/letsencrypt/live/audit360.example.com/privkey.pem;
    #
    #         location / {
    #             proxy_pass http://127.0.0.1:8000;
    #             proxy_set_header Host $host;
    #             proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    #             proxy_set_header X-Forwarded-Proto $scheme;
    #         }
    #     }
    #
    #     Obtain cert: sudo certbot --nginx -d audit360.example.com
    #
    # OPTION B — Uvicorn with direct SSL (requires cert files on disk)
    #   Uncomment and adjust paths below to point to your certificate and
    #   private key files (PEM format). Generate with Let's Encrypt certbot
    #   or a self-signed CA for internal use.
    #
    # Environment variables (set before launching):
    #   SSL_CERT_FILE  — Path to TLS certificate file (PEM)
    #   SSL_KEY_FILE   — Path to TLS private key file (PEM)
    #
    # Example:
    #   export SSL_CERT_FILE=/etc/ssl/certs/audit360.crt
    #   export SSL_KEY_FILE=/etc/ssl/private/audit360.key
    #   python server.py
    #
    # Uncomment for direct SSL via uvicorn:
    # ssl_cert = os.getenv("SSL_CERT_FILE")
    # ssl_key  = os.getenv("SSL_KEY_FILE")
    # if ssl_cert and ssl_key:
    #     uvicorn.run(app, host="0.0.0.0", port=443,
    #                 ssl_keyfile=ssl_key,
    #                 ssl_certfile=ssl_cert)
    # else:
    #     logger.warning("HTTPS not configured — set SSL_CERT_FILE and SSL_KEY_FILE")
    #     uvicorn.run(app, host="127.0.0.1", port=8000)
    uvicorn.run(app, host="127.0.0.1", port=8000)
