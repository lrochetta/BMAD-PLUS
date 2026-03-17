"""
Gamma Report Module — MCP Server v2.0
Professional PDF report generation via Gamma API.
5 tools: generate, check status, download PDF, list templates, check credits.
"""
import os
import time
import requests


GAMMA_API_KEY = os.getenv("GAMMA_API_KEY")
GAMMA_BASE_URL = "https://public-api.gamma.app/v1.0"


def _gamma_headers():
    return {"X-API-KEY": GAMMA_API_KEY, "Content-Type": "application/json"}


def register(mcp):
    """Register all gamma_report tools with the MCP server."""

    @mcp.tool()
    def gamma_generate_report(
        markdown_content: str,
        title: str,
        template_id: str = "g_4ct71y71u2jc2i5",
        export_as: str = "",
        image_urls: list[str] = [],
        instructions: str = ""
    ) -> str:
        """
        Generate a professional report using Gamma API (from-template).
        Uses split templates for large audits (>60 cards):
          Part 1 (g_4ct71y71u2jc2i5): Cover + Expert Global + Conformite
          Part 2 (g_a5an6dwsnwvi35h): STRIDE + Dependencies + Code + Verdict

        Args:
            markdown_content: Markdown content to fill the template
            title: Report title
            template_id: Gamma template gammaId (default: Part 1)
            export_as: '' (URL only) | 'pdf' | 'pptx'
            image_urls: Infographic URLs to embed in the report
            instructions: AI instructions for Gamma
        """
        # Build prompt
        prompt = markdown_content
        if image_urls:
            prompt += "\n\n## Infographies\nInsère les infographies suivantes :\n"
            for i, url in enumerate(image_urls, 1):
                prompt += f"\n![Infographie {i}]({url})\n"

        if not instructions:
            instructions = (
                "Utilise les données d'audit fournies pour remplir le rapport. "
                "Conserve TOUS les findings, scores et détails techniques. "
                "Explique les résultats techniques pour un public non-expert. "
                "Intègre les infographies aux endroits pertinents."
            )
        prompt = instructions + "\n\n" + prompt

        payload = {"gammaId": template_id, "prompt": prompt}
        if export_as in ("pdf", "pptx"):
            payload["exportAs"] = export_as

        try:
            response = requests.post(
                f"{GAMMA_BASE_URL}/generations/from-template",
                json=payload, headers=_gamma_headers(), timeout=30
            )

            if response.status_code in [200, 201, 202]:
                result = response.json()
                gen_id = result.get("generationId", "")

                if not gen_id:
                    return f"✅ Rapport instantané: {result.get('gammaUrl', 'N/A')}"

                # Poll for completion (max 600s = 10 minutes)
                for i in range(60):
                    time.sleep(10)
                    poll = requests.get(
                        f"{GAMMA_BASE_URL}/generations/{gen_id}",
                        headers={"X-API-KEY": GAMMA_API_KEY}, timeout=10
                    )
                    if poll.status_code == 200:
                        data = poll.json()
                        status = data.get("status", "unknown")

                        if status == "completed":
                            credits = data.get("credits", {})
                            msg = f"✅ Rapport Gamma généré !\n"
                            msg += f"📄 URL: {data.get('gammaUrl', 'N/A')}\n"
                            msg += f"💰 Crédits: {credits.get('deducted', '?')} utilisés, {credits.get('remaining', '?')} restants"
                            if export_as and "exportUrl" in data:
                                msg += f"\n📥 Export ({export_as.upper()}): {data['exportUrl']}"
                            return msg

                        elif status in ("failed", "error"):
                            return f"❌ Generation failed: {data.get('error', 'Unknown')}"

                return f"⏳ Timeout (600s). ID: {gen_id}. Utilisez gamma_check_status pour vérifier."
            else:
                return f"❌ API Error ({response.status_code}): {response.text[:500]}"
        except Exception as e:
            return f"❌ Erreur: {str(e)}"

    @mcp.tool()
    def gamma_check_status(generation_id: str) -> str:
        """
        Check the status of a Gamma generation.
        Args:
            generation_id: The generation ID returned by gamma_generate_report
        """
        try:
            response = requests.get(
                f"{GAMMA_BASE_URL}/generations/{generation_id}",
                headers={"X-API-KEY": GAMMA_API_KEY}, timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                status = data.get("status", "unknown")
                msg = f"Status: {status}\n"
                msg += f"URL: {data.get('gammaUrl', 'N/A')}\n"
                if "exportUrl" in data:
                    msg += f"Export: {data['exportUrl']}\n"
                credits = data.get("credits", {})
                if credits:
                    msg += f"Credits: {credits.get('deducted', '?')} used, {credits.get('remaining', '?')} left"
                return msg
            return f"❌ Error ({response.status_code}): {response.text[:300]}"
        except Exception as e:
            return f"❌ Error: {str(e)}"

    @mcp.tool()
    def gamma_download_pdf(
        export_url: str,
        save_path: str = ""
    ) -> str:
        """
        Download a Gamma PDF export. Export URLs expire — download immediately after generation.
        Args:
            export_url: The exportUrl from a completed Gamma generation
            save_path: Local path to save the PDF. Default: /tmp/gamma_export.pdf
        """
        if not save_path:
            save_path = "/tmp/gamma_export.pdf"

        try:
            response = requests.get(export_url, timeout=60)
            if response.status_code == 200:
                os.makedirs(os.path.dirname(save_path) or ".", exist_ok=True)
                with open(save_path, "wb") as f:
                    f.write(response.content)
                return f"✅ PDF saved: {save_path} ({len(response.content)} bytes)"
            return f"❌ Download failed ({response.status_code})"
        except Exception as e:
            return f"❌ Error: {str(e)}"

    @mcp.tool()
    def gamma_merge_pdfs(
        pdf_paths: list[str],
        output_path: str
    ) -> str:
        """
        Merge multiple PDF files into one. Used after split template generation.
        Args:
            pdf_paths: List of PDF file paths to merge (in order)
            output_path: Path for the merged output PDF
        """
        try:
            from PyPDF2 import PdfMerger
            merger = PdfMerger()
            for p in pdf_paths:
                if not os.path.exists(p):
                    return f"❌ File not found: {p}"
                merger.append(p)
            os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
            merger.write(output_path)
            merger.close()
            size = os.path.getsize(output_path)
            return f"✅ Merged {len(pdf_paths)} PDFs → {output_path} ({size} bytes)"
        except ImportError:
            return "❌ PyPDF2 not installed. Run: pip install PyPDF2"
        except Exception as e:
            return f"❌ Merge failed: {str(e)}"

    @mcp.tool()
    def gamma_credits() -> str:
        """Check remaining Gamma API credits."""
        try:
            # Use a minimal generation to check credits (we cancel immediately)
            # Alternative: check via the last generation status
            response = requests.get(
                f"{GAMMA_BASE_URL}/me",
                headers={"X-API-KEY": GAMMA_API_KEY}, timeout=10
            )
            if response.status_code == 200:
                data = response.json()
                return f"Gamma Account Info:\n{data}"
            return f"ℹ️ Credits endpoint returned {response.status_code}. Check via gamma_check_status with a recent generation ID."
        except Exception as e:
            return f"❌ Error: {str(e)}"
