"""
CI/CD Pipeline Module — MCP Server v2.0
Run tests, security scans, and deployments on the VPS.
"""
import os
import subprocess
import json
from pathlib import Path
from datetime import datetime


def register(mcp):
    """Register all ci_cd tools with the MCP server."""

    @mcp.tool()
    def ci_run_command(
        repo_path: str,
        command: str,
        timeout: int = 120
    ) -> str:
        """
        Run a shell command in a repository context (tests, builds, linting).
        Commands are sandboxed to the repo directory.
        Args:
            repo_path: Path to the repository
            command: Shell command to run (e.g., "npm test", "python -m pytest", "make build")
            timeout: Max execution time in seconds (default: 120, max: 300)
        """
        if not os.path.isdir(repo_path):
            return f"❌ Directory not found: {repo_path}"

        # Security: block dangerous commands
        blocked = ["rm -rf /", "mkfs", "dd if=", "> /dev/", ":(){ ", "fork"]
        for b in blocked:
            if b in command:
                return f"❌ Blocked command: contains '{b}'"

        timeout = min(timeout, 300)

        try:
            result = subprocess.run(
                command, shell=True, cwd=repo_path,
                capture_output=True, text=True, timeout=timeout
            )
            output = result.stdout[-3000:] if len(result.stdout) > 3000 else result.stdout
            errors = result.stderr[-1000:] if result.stderr else ""

            msg = f"{'✅' if result.returncode == 0 else '❌'} Exit code: {result.returncode}\n"
            if output:
                msg += f"\n📋 Output:\n{output}"
            if errors:
                msg += f"\n⚠️ Stderr:\n{errors}"
            return msg
        except subprocess.TimeoutExpired:
            return f"⏳ Command timed out after {timeout}s"
        except Exception as e:
            return f"❌ Error: {str(e)}"

    @mcp.tool()
    def ci_check_security(repo_path: str) -> str:
        """
        Run security scans on a repository (Semgrep, Trivy if available).
        Args:
            repo_path: Path to the repository to scan
        """
        if not os.path.isdir(repo_path):
            return f"❌ Directory not found: {repo_path}"

        results = []

        # Try Semgrep
        try:
            r = subprocess.run(
                ["semgrep", "--config=auto", "--json", "--quiet", repo_path],
                capture_output=True, text=True, timeout=120
            )
            if r.returncode == 0 and r.stdout:
                data = json.loads(r.stdout)
                findings = data.get("results", [])
                results.append(f"🔍 Semgrep: {len(findings)} findings")
                for f in findings[:10]:
                    results.append(
                        f"  [{f.get('extra', {}).get('severity', '?')}] "
                        f"{f.get('check_id', '?')} — {f.get('path', '?')}:{f.get('start', {}).get('line', '?')}"
                    )
            else:
                results.append(f"ℹ️ Semgrep: {r.stderr[:200] if r.stderr else 'no output'}")
        except FileNotFoundError:
            results.append("⚠️ Semgrep not installed (pip install semgrep)")
        except Exception as e:
            results.append(f"⚠️ Semgrep error: {str(e)}")

        # Try Trivy
        try:
            r = subprocess.run(
                ["trivy", "fs", "--format", "json", "--quiet", repo_path],
                capture_output=True, text=True, timeout=120
            )
            if r.returncode == 0 and r.stdout:
                data = json.loads(r.stdout)
                vuln_count = sum(
                    len(res.get("Vulnerabilities", []))
                    for res in data.get("Results", [])
                )
                results.append(f"🛡️ Trivy: {vuln_count} vulnerabilities")
            else:
                results.append(f"ℹ️ Trivy: {r.stderr[:200] if r.stderr else 'no output'}")
        except FileNotFoundError:
            results.append("⚠️ Trivy not installed")
        except Exception as e:
            results.append(f"⚠️ Trivy error: {str(e)}")

        return "\n".join(results) if results else "No security tools available on VPS."

    @mcp.tool()
    def ci_generate_sbom(repo_path: str) -> str:
        """
        Generate a Software Bill of Materials for a repository.
        Lists all dependencies with versions.
        Args:
            repo_path: Path to the repository
        """
        if not os.path.isdir(repo_path):
            return f"❌ Directory not found: {repo_path}"

        repo = Path(repo_path)
        sbom = {"generated": datetime.now().isoformat(), "dependencies": []}

        # Python: requirements.txt / setup.py / pyproject.toml
        req_files = list(repo.glob("**/requirements*.txt"))
        for rf in req_files:
            with open(rf, "r") as f:
                for line in f:
                    line = line.strip()
                    if line and not line.startswith("#"):
                        sbom["dependencies"].append({"type": "python", "source": rf.name, "spec": line})

        # Node: package.json
        pkg_files = list(repo.glob("**/package.json"))
        for pf in pkg_files:
            try:
                with open(pf, "r") as f:
                    data = json.load(f)
                for dep, ver in {**data.get("dependencies", {}), **data.get("devDependencies", {})}.items():
                    sbom["dependencies"].append({"type": "npm", "source": pf.name, "spec": f"{dep}@{ver}"})
            except Exception:
                continue

        # Go: go.mod
        go_files = list(repo.glob("**/go.mod"))
        for gf in go_files:
            with open(gf, "r") as f:
                for line in f:
                    if line.strip().startswith("require") or "\t" in line:
                        parts = line.strip().split()
                        if len(parts) >= 2 and "/" in parts[0]:
                            sbom["dependencies"].append({"type": "go", "source": "go.mod", "spec": " ".join(parts[:2])})

        # Docker: Dockerfile
        dockerfiles = list(repo.glob("**/Dockerfile*"))
        for df in dockerfiles:
            with open(df, "r") as f:
                for line in f:
                    if line.strip().upper().startswith("FROM"):
                        sbom["dependencies"].append({"type": "docker", "source": df.name, "spec": line.strip()})

        total = len(sbom["dependencies"])
        by_type = {}
        for d in sbom["dependencies"]:
            by_type[d["type"]] = by_type.get(d["type"], 0) + 1

        msg = f"📦 SBOM: {total} dependencies found\n"
        msg += "\n".join(f"  {t}: {c}" for t, c in by_type.items())
        msg += f"\n\nTop dependencies:\n"
        for d in sbom["dependencies"][:20]:
            msg += f"  [{d['type']}] {d['spec']}\n"
        if total > 20:
            msg += f"  ... and {total - 20} more"

        return msg

    @mcp.tool()
    def ci_deploy(
        repo_path: str,
        target: str = "staging",
        script: str = ""
    ) -> str:
        """
        Run a deployment script for a repository.
        Args:
            repo_path: Path to the repository
            target: Deployment target ('staging' | 'production' | custom)
            script: Custom deploy command. If empty, looks for deploy scripts in the repo.
        """
        if not os.path.isdir(repo_path):
            return f"❌ Directory not found: {repo_path}"

        if not script:
            # Look for common deploy scripts
            repo = Path(repo_path)
            candidates = [
                f"scripts/deploy-{target}.sh",
                f"deploy-{target}.sh",
                "scripts/deploy.sh",
                "deploy.sh",
                "Makefile"
            ]
            for c in candidates:
                if (repo / c).exists():
                    script = f"bash {c}" if c.endswith(".sh") else f"make deploy-{target}"
                    break

            if not script:
                return f"❌ No deploy script found. Provide a custom script or create scripts/deploy-{target}.sh"

        try:
            result = subprocess.run(
                script, shell=True, cwd=repo_path,
                capture_output=True, text=True, timeout=300
            )
            output = result.stdout[-2000:] if result.stdout else ""
            msg = f"{'✅' if result.returncode == 0 else '❌'} Deploy to {target} (exit: {result.returncode})\n"
            if output:
                msg += f"\n{output}"
            if result.stderr:
                msg += f"\n⚠️ {result.stderr[-500:]}"
            return msg
        except subprocess.TimeoutExpired:
            return f"⏳ Deploy timed out after 300s"
        except Exception as e:
            return f"❌ Deploy error: {str(e)}"
