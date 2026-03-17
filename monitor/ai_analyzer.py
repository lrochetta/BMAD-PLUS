#!/usr/bin/env python3
"""
BMAD+ AI Diff Analyzer
Uses Gemini API to analyze upstream changes and classify compatibility.
"""

import json

try:
    import google.generativeai as genai
except ImportError:
    genai = None


ANALYSIS_PROMPT = """You are an expert code analyst for the BMAD-METHOD framework.
Analyze the following upstream changes and produce a structured compatibility report for BMAD+, a custom fork.

BMAD+ has:
- 4 consolidated agents (strategist, architect-dev, quality, orchestrator) instead of 9
- 3 workflow phases (discovery, build, ship) instead of 4
- Custom module at src/bmad-plus/
- Core skills are shared with upstream

Previous upstream version: {prev_version}

## Recent commits:
{commits}

## Diff statistics:
{diff_stat}

## Key file changes (truncated):
{diff_content}

## Your analysis must include:

1. **Compatibility Classification** for each change:
   - 🟢 Compatible — can be merged automatically
   - 🟡 Review needed — may affect BMAD+ custom code
   - 🔴 Breaking — requires manual intervention

2. **Impact on BMAD+ agents** — Do any changes affect the upstream agents that our 4 agents are based on?

3. **New features worth adopting** — Any new skills, workflows, or improvements we should incorporate?

4. **Recommended actions** — Specific steps to take

Format your response as a WhatsApp-friendly message (use * for bold, no markdown headers).
Keep it concise — max 500 words.
"""


def analyze_diff_with_ai(commits, diff_stat, diff_content, api_key, prev_version="unknown"):
    """Analyze the diff using Gemini API."""

    if genai is None:
        return "⚠️ google-generativeai not installed. Run: pip install google-generativeai"

    genai.configure(api_key=api_key)
    model = genai.GenerativeModel("gemini-2.0-flash")

    prompt = ANALYSIS_PROMPT.format(
        prev_version=prev_version,
        commits=commits[:3000],
        diff_stat=diff_stat[:2000],
        diff_content=diff_content[:5000]
    )

    try:
        response = model.generate_content(prompt)
        return response.text
    except Exception as e:
        return f"⚠️ AI analysis failed: {str(e)}"
