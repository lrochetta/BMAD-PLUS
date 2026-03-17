#!/usr/bin/env python3
"""
BMAD+ MCP Bridge
Uses the existing Audit 360° MCP Server (VPS) for git/github operations.
Instead of running git locally, delegates to the MCP server's git_ops and github_ops tools.

This allows the monitoring system to:
1. Use the VPS-hosted MCP server for all git operations
2. Create PRs via github_ops when upstream changes are detected
3. Clone/pull upstream repos on the VPS
"""

import json

try:
    import requests
except ImportError:
    requests = None


class MCPBridge:
    """Bridge to Audit 360° MCP Server for git/github operations."""

    def __init__(self, mcp_url: str, mcp_token: str):
        """
        Args:
            mcp_url: MCP server base URL (e.g., http://89.167.54.204:8000)
            mcp_token: MCP authentication token
        """
        self.mcp_url = mcp_url.rstrip("/")
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {mcp_token}"
        }

    def call_tool(self, tool_name: str, arguments: dict) -> str:
        """Call an MCP tool via the server."""
        if requests is None:
            return "ERROR: requests library not installed"

        # MCP SSE transport - send tool call
        try:
            response = requests.post(
                f"{self.mcp_url}/call-tool",
                headers=self.headers,
                json={"name": tool_name, "arguments": arguments},
                timeout=120
            )
            if response.status_code == 200:
                return response.json().get("result", "OK")
            return f"ERROR ({response.status_code}): {response.text[:300]}"
        except Exception as e:
            return f"ERROR: {e}"

    # --- Git Operations (delegated to VPS) ---

    def git_clone(self, url: str, path: str = "") -> str:
        """Clone a repo on the VPS."""
        return self.call_tool("git_clone_repo", {"url": url, "path": path})

    def git_pull(self, repo_path: str) -> str:
        """Pull latest changes on VPS."""
        return self.call_tool("git_pull", {"repo_path": repo_path})

    def git_diff(self, repo_path: str, staged: bool = False) -> str:
        """Get diff on VPS."""
        return self.call_tool("git_diff", {"repo_path": repo_path, "staged": staged})

    def git_log(self, repo_path: str, limit: int = 20) -> str:
        """Get commit log on VPS."""
        return self.call_tool("git_log", {"repo_path": repo_path, "limit": limit})

    def git_status(self, repo_path: str) -> str:
        """Get repo status on VPS."""
        return self.call_tool("git_status", {"repo_path": repo_path})

    def git_commit(self, repo_path: str, message: str) -> str:
        """Commit changes on VPS."""
        return self.call_tool("git_commit", {"repo_path": repo_path, "message": message})

    def git_push(self, repo_path: str) -> str:
        """Push changes from VPS."""
        return self.call_tool("git_push", {"repo_path": repo_path})

    # --- GitHub Operations (delegated to VPS) ---

    def github_create_repo(self, name: str, private: bool = True, description: str = "") -> str:
        """Create a GitHub repo via VPS."""
        return self.call_tool("github_create_repo", {
            "name": name, "private": private, "description": description
        })

    def github_create_pr(self, repo_name: str, title: str, head: str, body: str = "") -> str:
        """Create a PR via VPS."""
        return self.call_tool("github_create_pr", {
            "repo_name": repo_name, "title": title, "head": head, "body": body
        })

    def github_push_files(self, repo_name: str, files: dict, commit_message: str = "") -> str:
        """Push files via GitHub API on VPS."""
        return self.call_tool("github_push_files", {
            "repo_name": repo_name, "files": files, "commit_message": commit_message
        })


def create_bridge(config: dict) -> MCPBridge:
    """Create a MCPBridge from config dict."""
    return MCPBridge(
        mcp_url=config.get("mcp_url", "http://89.167.54.204:8000"),
        mcp_token=config.get("mcp_token", "")
    )
