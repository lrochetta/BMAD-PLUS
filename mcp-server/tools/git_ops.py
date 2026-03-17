"""
Git Operations Module — MCP Server v2.0
Local git repository management via GitPython.
10 tools for complete Git lifecycle.
"""
import os
import tempfile
import git as gitpython


def register(mcp):
    """Register all git_ops tools with the MCP server."""

    @mcp.tool()
    def git_clone_repo(url: str, path: str = "") -> str:
        """
        Clone a Git repository to the VPS.
        Args:
            url: Repository URL (HTTPS or SSH)
            path: Optional local path. If empty, clones to /tmp/repos/{repo_name}
        """
        if not path:
            repo_name = url.rstrip("/").split("/")[-1].replace(".git", "")
            path = os.path.join(tempfile.gettempdir(), "repos", repo_name)

        if os.path.exists(path):
            return f"⚠️ Path already exists: {path}. Use git_pull to update."

        try:
            os.makedirs(os.path.dirname(path), exist_ok=True)
            repo = gitpython.Repo.clone_from(url, path)
            branch = repo.active_branch.name
            return f"✅ Cloned {url} → {path} (branch: {branch})"
        except Exception as e:
            return f"❌ Clone failed: {str(e)}"

    @mcp.tool()
    def git_pull(repo_path: str, remote: str = "origin", branch: str = "") -> str:
        """
        Pull latest changes from remote.
        Args:
            repo_path: Path to local repository
            remote: Remote name (default: origin)
            branch: Branch to pull (default: current branch)
        """
        try:
            repo = gitpython.Repo(repo_path)
            if branch:
                repo.git.checkout(branch)
            result = repo.remotes[remote].pull()
            summary = [f"{info.ref}: {info.note or 'up to date'}" for info in result]
            return f"✅ Pull from {remote}:\n" + "\n".join(summary)
        except Exception as e:
            return f"❌ Pull failed: {str(e)}"

    @mcp.tool()
    def git_status(repo_path: str) -> str:
        """
        Get repository status (modified, staged, untracked files).
        Args:
            repo_path: Path to local repository
        """
        try:
            repo = gitpython.Repo(repo_path)
            lines = []
            lines.append(f"Branch: {repo.active_branch.name}")
            lines.append(f"Clean: {not repo.is_dirty(untracked_files=True)}")

            if repo.index.diff("HEAD"):
                lines.append("\n📦 Staged:")
                for d in repo.index.diff("HEAD"):
                    lines.append(f"  {d.change_type}: {d.a_path}")

            if repo.index.diff(None):
                lines.append("\n📝 Modified (unstaged):")
                for d in repo.index.diff(None):
                    lines.append(f"  {d.change_type}: {d.a_path}")

            if repo.untracked_files:
                lines.append("\n❓ Untracked:")
                for f in repo.untracked_files[:20]:
                    lines.append(f"  {f}")
                if len(repo.untracked_files) > 20:
                    lines.append(f"  ... and {len(repo.untracked_files) - 20} more")

            return "\n".join(lines)
        except Exception as e:
            return f"❌ Status failed: {str(e)}"

    @mcp.tool()
    def git_diff(repo_path: str, file: str = "", staged: bool = False) -> str:
        """
        Show file diffs.
        Args:
            repo_path: Path to local repository
            file: Optional specific file to diff. Empty = all files
            staged: If True, show staged diffs (vs HEAD). If False, show unstaged diffs.
        """
        try:
            repo = gitpython.Repo(repo_path)
            args = ["--stat"] if not file else []

            if staged:
                diff = repo.git.diff("--cached", file, *args) if file else repo.git.diff("--cached", *args)
            else:
                diff = repo.git.diff(file, *args) if file else repo.git.diff(*args)

            if not diff:
                return "No differences found."
            # Truncate to 5000 chars to avoid overwhelming output
            if len(diff) > 5000:
                return diff[:5000] + f"\n\n... (truncated, {len(diff)} chars total)"
            return diff
        except Exception as e:
            return f"❌ Diff failed: {str(e)}"

    @mcp.tool()
    def git_commit(repo_path: str, message: str, files: list[str] = []) -> str:
        """
        Stage and commit files.
        Args:
            repo_path: Path to local repository
            message: Commit message
            files: List of file paths to stage. Empty = stage all modified files (git add -A)
        """
        try:
            repo = gitpython.Repo(repo_path)
            if files:
                repo.index.add(files)
            else:
                repo.git.add(A=True)

            commit = repo.index.commit(message)
            return f"✅ Committed: {commit.hexsha[:8]} — {message}"
        except Exception as e:
            return f"❌ Commit failed: {str(e)}"

    @mcp.tool()
    def git_push(repo_path: str, remote: str = "origin", branch: str = "") -> str:
        """
        Push commits to remote.
        Args:
            repo_path: Path to local repository
            remote: Remote name (default: origin)
            branch: Branch to push (default: current branch)
        """
        try:
            repo = gitpython.Repo(repo_path)
            branch = branch or repo.active_branch.name
            result = repo.remotes[remote].push(branch)
            summary = [f"{info.summary.strip()}" for info in result]
            return f"✅ Pushed {branch} → {remote}:\n" + "\n".join(summary)
        except Exception as e:
            return f"❌ Push failed: {str(e)}"

    @mcp.tool()
    def git_branch_list(repo_path: str) -> str:
        """
        List all branches (local and remote).
        Args:
            repo_path: Path to local repository
        """
        try:
            repo = gitpython.Repo(repo_path)
            current = repo.active_branch.name
            lines = ["Local branches:"]
            for b in repo.branches:
                prefix = "→ " if b.name == current else "  "
                lines.append(f"{prefix}{b.name}")

            lines.append("\nRemote branches:")
            for ref in repo.remotes.origin.refs:
                lines.append(f"  {ref.name}")
            return "\n".join(lines)
        except Exception as e:
            return f"❌ Branch list failed: {str(e)}"

    @mcp.tool()
    def git_branch_create(repo_path: str, name: str, from_branch: str = "") -> str:
        """
        Create a new branch.
        Args:
            repo_path: Path to local repository
            name: New branch name
            from_branch: Base branch (default: current HEAD)
        """
        try:
            repo = gitpython.Repo(repo_path)
            if from_branch:
                base = repo.refs[from_branch]
                new_branch = repo.create_head(name, base)
            else:
                new_branch = repo.create_head(name)
            return f"✅ Branch created: {new_branch.name}"
        except Exception as e:
            return f"❌ Branch creation failed: {str(e)}"

    @mcp.tool()
    def git_branch_checkout(repo_path: str, name: str) -> str:
        """
        Switch to a branch.
        Args:
            repo_path: Path to local repository
            name: Branch name to checkout
        """
        try:
            repo = gitpython.Repo(repo_path)
            repo.git.checkout(name)
            return f"✅ Switched to branch: {name}"
        except Exception as e:
            return f"❌ Checkout failed: {str(e)}"

    @mcp.tool()
    def git_log(repo_path: str, limit: int = 10) -> str:
        """
        Show recent commit history.
        Args:
            repo_path: Path to local repository
            limit: Number of commits to show (default: 10, max: 50)
        """
        try:
            repo = gitpython.Repo(repo_path)
            limit = min(limit, 50)
            lines = []
            for commit in repo.iter_commits(max_count=limit):
                date = commit.committed_datetime.strftime("%Y-%m-%d %H:%M")
                lines.append(f"{commit.hexsha[:8]} | {date} | {commit.author.name} | {commit.message.strip()[:80]}")
            return f"Last {len(lines)} commits:\n" + "\n".join(lines)
        except Exception as e:
            return f"❌ Log failed: {str(e)}"
