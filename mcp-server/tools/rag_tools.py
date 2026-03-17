"""
RAG Tools Module — MCP Server v2.0
Knowledge Base consultation and administration.
Uses ChromaDB + SentenceTransformers for semantic search.
"""
import subprocess
import os


def register(mcp):
    """Register all rag tools with the MCP server."""

    # Import RAG engine lazily to avoid import errors if not available
    from rag import RAGEngine
    rag_engine = RAGEngine()

    @mcp.tool()
    def consult_audit_standards(query: str, limit: int = 5) -> str:
        """
        Consults the Industrial Audit Knowledge Base (ASVS, PCI-DSS, Semgrep Rules).
        Use this to find specific norms, checklists, or code patterns.
        Args:
            query: The search question (e.g., "What is the ASVS requirement for password complexity?")
            limit: Number of results to return (default 5)
        """
        return rag_engine.query_norms(query, n_results=limit)

    @mcp.tool()
    def admin_refresh_knowledge() -> str:
        """Triggers a re-ingestion of all knowledge sources (git pull + re-index)."""
        subprocess.Popen(["python", "ingest.py"])
        return "✅ Knowledge refresh triggered in background."

    @mcp.tool()
    def search_cve(query: str, limit: int = 5) -> str:
        """
        Search the CVE/vulnerability database for known vulnerabilities.
        Args:
            query: Search query (e.g., "curl buffer overflow", "log4j", "CVE-2024-xxxx")
            limit: Number of results (default 5)
        """
        # Try RAG first (if CVEs are ingested)
        results = rag_engine.query_norms(query, n_results=limit)
        if results:
            return f"🔍 CVE/Vulnerability search results:\n\n{results}"
        return "No CVE data found in local knowledge base. Run admin_refresh_knowledge to update."

    @mcp.tool()
    def consult_past_audits(query: str, limit: int = 5) -> str:
        """
        Search findings from previous audits.
        Useful to find patterns, recurring issues, or reference implementations.
        Args:
            query: Search query (e.g., "SQL injection", "authentication bypass", "Docker misconfiguration")
            limit: Number of results (default 5)
        """
        import json
        from pathlib import Path

        results = []
        reports_dir = Path("reports")
        if not reports_dir.exists():
            return "No past audits found in the reports directory."

        for audit_file in reports_dir.rglob("*_audit.json"):
            try:
                with open(audit_file, "r", encoding="utf-8") as f:
                    data = json.load(f)

                # Search in findings
                findings = data.get("findings", [])
                for finding in findings:
                    title = finding.get("title", "")
                    desc = finding.get("description", "")
                    if query.lower() in title.lower() or query.lower() in desc.lower():
                        results.append(
                            f"[{audit_file.parent.parent.name}/{audit_file.parent.name}] "
                            f"{finding.get('severity', '?')}: {title}"
                        )
            except Exception:
                continue

        if results:
            return f"Found {len(results)} matching findings:\n" + "\n".join(results[:limit])
        return f"No findings matching '{query}' in past audits."
