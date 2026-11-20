---
name: dev-studio
description: Open the installed Dev Studio pack for its six personas and 38 product, architecture, documentation and development workflows.
---

# Dev Studio dispatcher

In an installed project, read the [Dev Studio pack](../pack-dev-studio/SKILL.md)
and follow its activation procedure. It resolves the requested persona and
workflow through the shipped catalog. The host executes the instructions;
`bmad-plus studio prepare` only loads a read-only context bundle.

This dispatcher is installed at `.agents/skills/dev-studio/SKILL.md`. Its sibling
pack is at `.agents/skills/pack-dev-studio/SKILL.md`. In the BMAD+ source checkout,
read `src/bmad-plus/packs/pack-dev-studio/SKILL.md` instead; the source and installed
layouts intentionally differ.

If the pack is absent, report the missing Dev Studio installation. Do not invent
routes or treat a dispatcher without its resource files as an executable pack.
