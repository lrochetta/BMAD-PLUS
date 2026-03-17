"""
Audit Engine Module — MCP Server v2.0
Automated audit scanning and management.
"""
import os
import json
import tempfile
from pathlib import Path
from datetime import datetime


def register(mcp):
    """Register all audit_engine tools with the MCP server."""

    @mcp.tool()
    def audit_scan_repo(
        repo_url: str,
        client_name: str,
        project_name: str
    ) -> str:
        """
        Clone a repository and prepare it for audit scanning.
        Creates the audit directory structure and initial metadata.
        Args:
            repo_url: Git repository URL to audit
            client_name: Client name (e.g., "raphaelribes")
            project_name: Project name (e.g., "pixitainer")
        """
        import git as gitpython

        # Create audit directory
        audit_dir = Path("reports") / client_name.lower() / project_name.lower()
        audit_dir.mkdir(parents=True, exist_ok=True)

        # Clone to temp
        clone_dir = Path(tempfile.gettempdir()) / "audit-repos" / project_name
        if clone_dir.exists():
            import shutil
            shutil.rmtree(clone_dir)

        try:
            repo = gitpython.Repo.clone_from(repo_url, str(clone_dir))
            # Gather basic stats
            file_count = sum(1 for _ in clone_dir.rglob("*") if _.is_file())
            ext_count = {}
            for f in clone_dir.rglob("*"):
                if f.is_file() and f.suffix:
                    ext_count[f.suffix] = ext_count.get(f.suffix, 0) + 1

            top_ext = sorted(ext_count.items(), key=lambda x: -x[1])[:10]
            commit_count = sum(1 for _ in repo.iter_commits(max_count=1000))

            # Save metadata
            metadata = {
                "client": client_name,
                "project": project_name,
                "repo_url": repo_url,
                "scan_date": datetime.now().isoformat(),
                "clone_path": str(clone_dir),
                "stats": {
                    "total_files": file_count,
                    "total_commits": commit_count,
                    "languages": {k: v for k, v in top_ext},
                    "branch": repo.active_branch.name
                }
            }

            meta_path = audit_dir / f"{datetime.now().strftime('%Y-%m-%d')}_scan.json"
            with open(meta_path, "w", encoding="utf-8") as f:
                json.dump(metadata, f, indent=2, ensure_ascii=False)

            msg = f"✅ Repo cloned and ready for audit\n"
            msg += f"📁 Clone: {clone_dir}\n"
            msg += f"📊 {file_count} files, {commit_count} commits\n"
            msg += f"🔤 Languages: {', '.join(f'{k}({v})' for k, v in top_ext[:5])}\n"
            msg += f"📋 Metadata: {meta_path}"
            return msg

        except Exception as e:
            return f"❌ Scan failed: {str(e)}"

    @mcp.tool()
    def audit_list(client: str = "") -> str:
        """
        List all past audits, optionally filtered by client.
        Args:
            client: Client name filter (empty = all clients)
        """
        reports_dir = Path("reports")
        if not reports_dir.exists():
            return "No audits found."

        lines = ["📋 Audit History:"]
        for client_dir in sorted(reports_dir.iterdir()):
            if not client_dir.is_dir():
                continue
            if client and client.lower() != client_dir.name.lower():
                continue

            lines.append(f"\n👤 {client_dir.name}")
            for project_dir in sorted(client_dir.iterdir()):
                if not project_dir.is_dir():
                    continue
                audits = list(project_dir.glob("*_audit.json")) + list(project_dir.glob("*_scan.json"))
                dates = [f.stem.split("_")[0] for f in sorted(audits, reverse=True)]
                lines.append(f"  📁 {project_dir.name} — {len(audits)} audits ({', '.join(dates[:3])})")

        return "\n".join(lines) if len(lines) > 1 else "No audits found."

    @mcp.tool()
    def audit_get_score(client: str, project: str) -> str:
        """
        Get the latest audit score for a client/project.
        Args:
            client: Client name
            project: Project name
        """
        audit_dir = Path("reports") / client.lower() / project.lower()
        if not audit_dir.exists():
            return f"No audit found for {client}/{project}"

        # Find latest audit file
        audits = sorted(audit_dir.glob("*_audit.json"), reverse=True)
        if not audits:
            return f"No audit results found for {client}/{project}"

        try:
            with open(audits[0], "r", encoding="utf-8") as f:
                data = json.load(f)

            score = data.get("score", {})
            findings = data.get("findings", [])

            severity_counts = {}
            for f_item in findings:
                sev = f_item.get("severity", "Unknown")
                severity_counts[sev] = severity_counts.get(sev, 0) + 1

            msg = f"📊 Audit Score: {client}/{project}\n"
            msg += f"Score: {score.get('global', '?')}/100 — Grade {score.get('grade', '?')}\n"
            msg += f"Date: {audits[0].stem.split('_')[0]}\n"
            msg += f"Findings: {' | '.join(f'{k}: {v}' for k, v in severity_counts.items())}\n"

            domains = score.get("domains", {})
            if domains:
                msg += "\nDomain Scores:\n"
                for domain, dscore in domains.items():
                    msg += f"  {domain}: {dscore}/10\n"

            return msg
        except Exception as e:
            return f"❌ Error reading audit: {str(e)}"

    @mcp.tool()
    def audit_compare_versions(
        client: str,
        project: str
    ) -> str:
        """
        Compare the two most recent audits for a project (score evolution).
        Args:
            client: Client name
            project: Project name
        """
        audit_dir = Path("reports") / client.lower() / project.lower()
        if not audit_dir.exists():
            return f"No audits found for {client}/{project}"

        audits = sorted(audit_dir.glob("*_audit.json"), reverse=True)
        if len(audits) < 2:
            return f"Need at least 2 audits to compare. Found: {len(audits)}"

        try:
            with open(audits[0], "r", encoding="utf-8") as f:
                latest = json.load(f)
            with open(audits[1], "r", encoding="utf-8") as f:
                previous = json.load(f)

            latest_score = latest.get("score", {}).get("global", 0)
            prev_score = previous.get("score", {}).get("global", 0)
            diff = latest_score - prev_score
            arrow = "📈" if diff > 0 else "📉" if diff < 0 else "➡️"

            msg = f"{arrow} Score Evolution: {client}/{project}\n"
            msg += f"  {audits[1].stem}: {prev_score}/100\n"
            msg += f"  {audits[0].stem}: {latest_score}/100\n"
            msg += f"  Change: {'+' if diff > 0 else ''}{diff} points\n"

            # Compare findings count
            prev_findings = len(previous.get("findings", []))
            latest_findings = len(latest.get("findings", []))
            msg += f"\n  Findings: {prev_findings} → {latest_findings}"

            return msg
        except Exception as e:
            return f"❌ Compare failed: {str(e)}"
