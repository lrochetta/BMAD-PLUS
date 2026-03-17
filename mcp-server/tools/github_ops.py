"""
GitHub API Operations Module — MCP Server v2.0
Enhanced GitHub repository management via REST API.
7 tools for repo lifecycle, PRs, and collaboration.
"""
import os
import base64 as b64
import requests


GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
DEFAULT_OWNER = os.getenv("GITHUB_USER", "lrochetta")
GH_HEADERS = {
    "Authorization": f"token {GITHUB_TOKEN}",
    "Accept": "application/vnd.github.v3+json"
}


def register(mcp):
    """Register all github_ops tools with the MCP server."""

    @mcp.tool()
    def github_create_repo(
        name: str,
        private: bool = True,
        description: str = "",
        owner: str = ""
    ) -> str:
        """
        Create a GitHub repository.
        Args:
            name: Repository name (e.g., 'my-project' or 'audit-client-project')
            private: True for private repo (default), False for public
            description: Optional repo description
            owner: GitHub owner/org. Default: from GITHUB_USER env var
        """
        owner = owner or DEFAULT_OWNER
        data = {
            "name": name,
            "private": private,
            "description": description or f"Created by Audit360 MCP",
            "auto_init": True
        }
        response = requests.post(
            "https://api.github.com/user/repos", json=data, headers=GH_HEADERS
        )
        if response.status_code == 201:
            url = response.json()["html_url"]
            visibility = "private" if private else "public"
            return f"✅ Repo created ({visibility}): {url}"
        return f"❌ Error ({response.status_code}): {response.text[:300]}"

    @mcp.tool()
    def github_push_files(
        repo_name: str,
        files: dict[str, str],
        commit_message: str = "Update via MCP",
        owner: str = "",
        binary_files: dict[str, str] = {}
    ) -> str:
        """
        Push files to a GitHub repository.
        Args:
            repo_name: Repository name (without owner)
            files: Dict of {path: text_content} for text files
            commit_message: Commit message
            owner: GitHub owner (default: GITHUB_USER env)
            binary_files: Dict of {path: base64_content} for binary files (images, PDFs)
        """
        owner = owner or DEFAULT_OWNER
        results = []

        all_files = {}
        for path, content in files.items():
            all_files[path] = b64.b64encode(content.encode("utf-8")).decode("ascii")
        for path, b64_content in binary_files.items():
            all_files[path] = b64_content  # Already base64

        for path, encoded in all_files.items():
            url = f"https://api.github.com/repos/{owner}/{repo_name}/contents/{path}"
            get_res = requests.get(url, headers=GH_HEADERS)
            sha = get_res.json().get("sha") if get_res.status_code == 200 else None

            data = {"message": commit_message, "content": encoded}
            if sha:
                data["sha"] = sha

            put_res = requests.put(url, json=data, headers=GH_HEADERS)
            if put_res.status_code in [200, 201]:
                results.append(f"✅ {path}")
            else:
                results.append(f"❌ {path}: {put_res.text[:150]}")

        return "\n".join(results)

    @mcp.tool()
    def github_list_repos(
        owner: str = "",
        type: str = "all",
        limit: int = 30
    ) -> str:
        """
        List GitHub repositories.
        Args:
            owner: GitHub owner (default: GITHUB_USER)
            type: 'all' | 'public' | 'private' | 'sources' | 'forks'
            limit: Max repos to return (default: 30)
        """
        owner = owner or DEFAULT_OWNER
        response = requests.get(
            f"https://api.github.com/users/{owner}/repos",
            headers=GH_HEADERS,
            params={"type": type, "per_page": min(limit, 100), "sort": "updated"}
        )
        if response.status_code != 200:
            return f"❌ Error: {response.text[:300]}"

        repos = response.json()
        lines = [f"Repos for {owner} ({len(repos)} found):"]
        for r in repos:
            vis = "🔒" if r["private"] else "🌐"
            lines.append(f"  {vis} {r['name']} — {r.get('description', '')[:60]} ({r['updated_at'][:10]})")
        return "\n".join(lines)

    @mcp.tool()
    def github_create_pr(
        repo_name: str,
        title: str,
        head: str,
        base: str = "main",
        body: str = "",
        owner: str = ""
    ) -> str:
        """
        Create a Pull Request.
        Args:
            repo_name: Repository name
            title: PR title
            head: Source branch name
            base: Target branch (default: main)
            body: PR description in markdown
            owner: GitHub owner (default: GITHUB_USER)
        """
        owner = owner or DEFAULT_OWNER
        data = {"title": title, "head": head, "base": base, "body": body}
        response = requests.post(
            f"https://api.github.com/repos/{owner}/{repo_name}/pulls",
            json=data, headers=GH_HEADERS
        )
        if response.status_code == 201:
            pr = response.json()
            return f"✅ PR #{pr['number']} created: {pr['html_url']}"
        return f"❌ PR creation failed ({response.status_code}): {response.text[:300]}"

    @mcp.tool()
    def github_list_prs(
        repo_name: str,
        state: str = "open",
        owner: str = ""
    ) -> str:
        """
        List Pull Requests.
        Args:
            repo_name: Repository name
            state: 'open' | 'closed' | 'all' (default: open)
            owner: GitHub owner (default: GITHUB_USER)
        """
        owner = owner or DEFAULT_OWNER
        response = requests.get(
            f"https://api.github.com/repos/{owner}/{repo_name}/pulls",
            headers=GH_HEADERS,
            params={"state": state, "per_page": 30}
        )
        if response.status_code != 200:
            return f"❌ Error: {response.text[:300]}"

        prs = response.json()
        if not prs:
            return f"No {state} PRs in {owner}/{repo_name}."

        lines = [f"PRs ({state}) for {owner}/{repo_name}:"]
        for pr in prs:
            lines.append(f"  #{pr['number']} [{pr['state']}] {pr['title']} — {pr['user']['login']} ({pr['created_at'][:10]})")
        return "\n".join(lines)

    @mcp.tool()
    def github_delete_repo(repo_name: str, owner: str = "") -> str:
        """
        Delete a GitHub repository. USE WITH CAUTION.
        Args:
            repo_name: Repository name to delete
            owner: GitHub owner (default: GITHUB_USER)
        """
        owner = owner or DEFAULT_OWNER
        response = requests.delete(
            f"https://api.github.com/repos/{owner}/{repo_name}",
            headers=GH_HEADERS
        )
        if response.status_code == 204:
            return f"✅ Repo {owner}/{repo_name} deleted."
        return f"❌ Delete failed ({response.status_code}): {response.text[:300]}"

    @mcp.tool()
    def github_add_collaborator(
        repo_name: str,
        username: str,
        permission: str = "pull",
        owner: str = ""
    ) -> str:
        """
        Invite a collaborator to a repository.
        Args:
            repo_name: Repository name
            username: GitHub username to invite
            permission: 'pull' (read) | 'push' (write) | 'admin' (default: pull)
            owner: GitHub owner (default: GITHUB_USER)
        """
        owner = owner or DEFAULT_OWNER
        response = requests.put(
            f"https://api.github.com/repos/{owner}/{repo_name}/collaborators/{username}",
            headers=GH_HEADERS,
            json={"permission": permission}
        )
        if response.status_code in [201, 204]:
            return f"✅ {username} invited to {repo_name} with {permission} access."
        return f"❌ Failed ({response.status_code}): {response.text[:300]}"
