"""
Audit 360° MCP Server v2.0
==========================
Modular MCP server with 35+ tools for Git Ops, GitHub, Gamma Reports,
RAG Knowledge Base, Audit Engine, CI/CD, and Orchestration.

Deployed on VPS: http://89.167.54.204:8000/sse
"""
import os
import subprocess

# --- Configuration ---
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GAMMA_API_KEY = os.getenv("GAMMA_API_KEY")
MCP_TOKEN = os.getenv("MCP_AUDIT360_TOKEN")

if not all([GITHUB_TOKEN, GAMMA_API_KEY, MCP_TOKEN]):
    raise ValueError("Missing required environment variables: GITHUB_TOKEN, GAMMA_API_KEY, MCP_AUDIT360_TOKEN")

# --- MCP Application ---
from mcp.server.fastmcp import FastMCP
from mcp.server.fastmcp.server import TransportSecuritySettings

security = TransportSecuritySettings(
    allowed_hosts=["*", "89.167.54.204", "89.167.54.204:8000", "0.0.0.0"],
    enable_dns_rebinding_protection=False
)
mcp = FastMCP("audit360-tools", transport_security=security)

# --- RAG Startup ---
if not os.path.exists("chroma_db") or not os.listdir("chroma_db"):
    print("🧠 RAG: Knowledge Base empty. Triggering initial ingestion...")
    subprocess.Popen(["python", "ingest.py"])
else:
    print("🧠 RAG: Knowledge Base loaded.")

# --- Register All Tool Modules ---
from tools import git_ops, github_ops, gamma_report, rag_tools
from tools import audit_engine, ci_cd, orchestrator

git_ops.register(mcp)        # 10 tools: clone, pull, status, diff, commit, push, branch...
github_ops.register(mcp)     # 7 tools: create/list/delete repo, push files, PRs, collaborator
gamma_report.register(mcp)   # 5 tools: generate, check status, download PDF, merge, credits
rag_tools.register(mcp)      # 4 tools: consult standards, refresh, search CVE, past audits
audit_engine.register(mcp)   # 4 tools: scan repo, list audits, get score, compare versions
ci_cd.register(mcp)          # 4 tools: run command, security scan, SBOM, deploy
orchestrator.register(mcp)   # 1 tool:  orchestrate full audit pipeline

print("🔧 Registered 35 MCP tools across 7 modules")

# --- DASHBOARD EXTENSIONS ---
from starlette.responses import HTMLResponse, JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response
import base64
import json
import glob
from pathlib import Path


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

                expected_user = os.getenv("DASHBOARD_USER", "admin")
                expected_pass = os.getenv("DASHBOARD_PASS", "")
                if not expected_pass or username != expected_user or password != expected_pass:
                    return Response(status_code=401, headers={"WWW-Authenticate": "Basic"})
            except Exception:
                return Response(status_code=401, headers={"WWW-Authenticate": "Basic"})

        return await call_next(request)


# --- Dashboard Routes ---
async def dashboard(request):
    try:
        if os.path.exists("dashboard.html"):
            with open("dashboard.html", "r", encoding="utf-8") as f:
                return HTMLResponse(f.read())
        return HTMLResponse("<h1>Dashboard HTML missing</h1>", status_code=404)
    except Exception as e:
        return HTMLResponse(f"<h1>Error</h1><p>{str(e)}</p>", status_code=500)


async def audit_api(request):
    """Legacy endpoint for latest audit"""
    try:
        if os.path.exists("latest_audit.json"):
            with open("latest_audit.json", "r", encoding="utf-8") as f:
                return JSONResponse(json.load(f))
        return JSONResponse({"error": "No legacy audit data found"}, status_code=404)
    except Exception:
        return JSONResponse({"error": "Error reading legacy data"}, status_code=500)


async def history_api(request):
    """List all available audits structured by Client/Project"""
    reports_dir = Path("reports")
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
    filepath = Path(f"reports/{client}/{project}/{filename}")

    try:
        filepath.resolve().relative_to(Path("reports").resolve())
    except ValueError:
        return JSONResponse({"error": "Invalid path"}, status_code=403)

    if filepath.exists():
        with open(filepath, "r", encoding="utf-8") as f:
            return JSONResponse(json.load(f))
    return JSONResponse({"error": "Audit not found"}, status_code=404)


async def server_info(request):
    """Server info endpoint — lists all registered tools."""
    return JSONResponse({
        "name": "Audit 360° MCP Server",
        "version": "2.0.0",
        "tools_count": 35,
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

    # 1. Get Starlette App from FastMCP
    if hasattr(mcp, '_sse_app'):
        app = mcp._sse_app
    elif hasattr(mcp, 'sse_app'):
        app = mcp.sse_app()
    else:
        raise RuntimeError("Could not find ASGI app in FastMCP")

    # 2. Add Middleware
    app.add_middleware(BasicAuthMiddleware)

    # 3. Add Routes
    app.add_route("/dashboard", dashboard, methods=["GET"])
    app.add_route("/api/audit-latest", audit_api, methods=["GET"])
    app.add_route("/api/history", history_api, methods=["GET"])
    app.add_route("/api/audit/{client}/{project}/{filename}", audit_detail_api, methods=["GET"])
    app.add_route("/api/info", server_info, methods=["GET"])

    print("✅ Audit 360° MCP Server v2.0 — 35 tools, 7 modules")
    print("📡 SSE: http://0.0.0.0:8000/sse")
    print("📊 Dashboard: http://0.0.0.0:8000/dashboard")

    # 4. Run
    uvicorn.run(app, host="0.0.0.0", port=8000)
