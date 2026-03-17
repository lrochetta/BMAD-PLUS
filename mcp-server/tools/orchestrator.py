"""
Orchestrator Module — MCP Server v2.0
Full audit E2E orchestration — one call to rule them all.
"""
import os
import json
import time
from datetime import datetime
from pathlib import Path


def register(mcp):
    """Register the orchestrator tool."""

    @mcp.tool()
    def orchestrate_full_audit(
        repo_url: str,
        client_name: str,
        project_name: str,
        export_pdf: bool = True,
        create_github_repo: bool = True
    ) -> str:
        """
        Orchestrate a complete audit pipeline with a single call.
        Steps: Clone → Scan → Create GitHub repo → Generate reports structure.
        
        Note: This tool sets up the infrastructure. The actual audit analysis
        should be performed by the specialized audit agents (Blue Team, Red Team, etc.)
        using the tools provided by this MCP server.

        Args:
            repo_url: Git repository URL to audit
            client_name: Client name
            project_name: Project name
            export_pdf: Whether to prepare for Gamma PDF export (default: True)
            create_github_repo: Whether to create a private GitHub repo for delivery (default: True)
        """
        import git as gitpython
        import tempfile
        import shutil
        import requests

        GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
        GITHUB_USER = os.getenv("GITHUB_USER", "lrochetta")

        log = []
        log.append(f"🚀 Starting full audit: {client_name}/{project_name}")
        log.append(f"📦 Repo: {repo_url}")
        log.append(f"⏰ {datetime.now().strftime('%Y-%m-%d %H:%M')}")
        log.append("")

        # Step 1: Clone
        clone_dir = Path(tempfile.gettempdir()) / "audit-repos" / project_name
        if clone_dir.exists():
            shutil.rmtree(clone_dir)

        try:
            repo = gitpython.Repo.clone_from(repo_url, str(clone_dir))
            file_count = sum(1 for _ in clone_dir.rglob("*") if _.is_file())
            log.append(f"✅ Step 1/4: Cloned ({file_count} files, branch: {repo.active_branch.name})")
        except Exception as e:
            log.append(f"❌ Step 1/4: Clone failed: {str(e)}")
            return "\n".join(log)

        # Step 2: Create audit directory structure
        audit_dir = Path("reports") / client_name.lower() / project_name.lower()
        audit_dir.mkdir(parents=True, exist_ok=True)

        metadata = {
            "client": client_name,
            "project": project_name,
            "repo_url": repo_url,
            "audit_date": datetime.now().isoformat(),
            "clone_path": str(clone_dir),
            "status": "in_progress",
            "stats": {"total_files": file_count}
        }
        meta_path = audit_dir / f"{datetime.now().strftime('%Y-%m-%d')}_audit.json"
        with open(meta_path, "w", encoding="utf-8") as f:
            json.dump(metadata, f, indent=2, ensure_ascii=False)
        log.append(f"✅ Step 2/4: Audit structure created ({audit_dir})")

        # Step 3: Create GitHub repo (if requested)
        if create_github_repo:
            repo_name = f"audit-{client_name.lower().replace(' ', '-')}-{project_name.lower()}"
            headers = {
                "Authorization": f"token {GITHUB_TOKEN}",
                "Accept": "application/vnd.github.v3+json"
            }
            data = {
                "name": repo_name,
                "private": True,
                "description": f"Audit 360° — {client_name} / {project_name}",
                "auto_init": True
            }
            try:
                r = requests.post("https://api.github.com/user/repos", json=data, headers=headers)
                if r.status_code == 201:
                    github_url = r.json()["html_url"]
                    log.append(f"✅ Step 3/4: GitHub repo created: {github_url}")
                elif r.status_code == 422:
                    log.append(f"ℹ️ Step 3/4: GitHub repo already exists: {GITHUB_USER}/{repo_name}")
                else:
                    log.append(f"⚠️ Step 3/4: GitHub repo creation failed ({r.status_code})")
            except Exception as e:
                log.append(f"⚠️ Step 3/4: GitHub error: {str(e)}")
        else:
            log.append("⏭️ Step 3/4: GitHub repo creation skipped")

        # Step 4: Summary
        log.append(f"✅ Step 4/4: Ready for audit agents")
        log.append("")
        log.append("📋 Next steps:")
        log.append(f"  1. Run audit agents on cloned repo: {clone_dir}")
        log.append(f"  2. Save .md reports to: {audit_dir}")
        log.append("  3. Generate infographics (scorecard, ASVS, STRIDE, dashboard)")
        log.append("  4. Use gamma_generate_report (Part 1 + Part 2) for PDF")
        log.append("  5. Use github_push_files to push deliverables")
        if export_pdf:
            log.append("")
            log.append("🎯 Gamma Templates:")
            log.append("  Part 1 (Expert+Conformité): g_4ct71y71u2jc2i5")
            log.append("  Part 2 (STRIDE+Deps+Code): g_a5an6dwsnwvi35h")

        return "\n".join(log)
