---
name: pack-ghostwriter
description: Write, edit, humanize, localize or review a reader-facing deliverable. Use for an explicit editorial task or a project-selected review of an agent's assembled output. Supports reusable author and brand voice profiles.
---

# Ghostwriter

Read the [persona](ghostwriter.md) and the [editorial contract](shared/editorial-contract.md). Use the request, supplied text and any brief already prepared by another agent to select one workflow. A request for feedback leaves the draft intact. A request for a finished piece returns the piece in the requested language and format.

Route a request such as “humanise ce texte”, “humanizer du contenu”, “humanize this text” or “deixe este texto mais natural” straight to **Humanize**. Use the passage supplied in this turn, a clearly referenced earlier answer, or the attached document. If the source is missing or ambiguous, ask only for the passage or file the user means. Keep the existing language and register by default. A question about how humanization works calls for an explanation.

| User's request | Workflow | Working skill |
| --- | --- | --- |
| Learn my voice from these approved examples, or update our style profile | [Voice profile](workflows/voice-profile.md) | `ghostwriter-voice` |
| Write a reply, email, article or script from this brief | [Draft](workflows/draft.md) | `ghostwriter-write` |
| Keep the substance and fix repetitive or artificial phrasing | [Humanize](workflows/humanize.md) | `ghostwriter-humanize` |
| Reorganize the argument, clarify the action or adapt the piece to another channel | [Improve](workflows/improve.md) | `ghostwriter-edit` |
| Adapt a piece to the reader's language and market | [Localize](workflows/localize.md) | `ghostwriter-localize` |
| Review a completed output against its brief and its sources | [Agent output review](workflows/agent-output-review.md) | `ghostwriter-verify` |

For a story whose author asks to debate narrative structure, open the optional [narrative council](workshops/council/README.md). The council compares the requested approaches, including the three acts and the hero's journey. Bring the author's chosen direction back to the draft or structural edit.

Read the working skill at `.agents/skills/<skill>/SKILL.md` in an installed project. In a source checkout the six skill directories are siblings under `src/bmad-plus/skills/`. Use the [intake](intake.yaml) for material gaps and the [execution guide](shared/execution.md) for review evidence and handoffs. If a required resource is missing, identify its path and report the affected step as incomplete.
