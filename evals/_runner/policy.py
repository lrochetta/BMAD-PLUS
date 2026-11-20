"""Source-registry discovery and explicit evaluation gate policy (offline)."""
from __future__ import annotations

from pathlib import Path

import yaml

from context_evidence import EvidenceError, explicit_root, read_record, resolve_inside

REPOSITORY = Path(__file__).resolve().parents[2]


def load_registry(path: Path | None = None) -> dict:
    path = path or REPOSITORY / "registry.yaml"
    content = read_record(explicit_root(path.parent), path.name, limit=1024 * 1024).content
    value = yaml.safe_load(content)
    if not isinstance(value, dict) or not isinstance(value.get("packs"), dict) or not value["packs"]:
        raise EvidenceError("Registry must declare a nonempty packs mapping")
    models = value.get("targets", {}).get("models_supported")
    if not isinstance(models, list) or not models or any(not isinstance(m, str) for m in models):
        raise EvidenceError("Registry must declare targets.models_supported")
    return value


def discovery_pattern(registry: dict) -> str:
    value = registry.get("eval", {}).get("suite_glob")
    if (not isinstance(value, str) or not value.startswith("evals/")
            or not value.endswith("/eval.yaml") or "\\" in value
            or any(p in ("", ".", "..") for p in value.split("/"))
            or any(c in value for c in "{}[]:?!")):
        raise EvidenceError("eval.suite_glob must be an evals-relative glob ending /eval.yaml")
    return value.removeprefix("evals/")


def discover(root: Path, registry: dict | None = None) -> list[Path]:
    root = explicit_root(root)
    pattern = discovery_pattern(registry or load_registry())
    found = []
    for path in sorted(root.glob(pattern)):
        relative = path.relative_to(root)
        if any(part.startswith(("_", ".")) for part in relative.parts[:-1]):
            continue
        found.append(resolve_inside(root, relative.as_posix()))
    return found


def gate_policy(registry: dict, name: str) -> dict:
    gates = registry.get("eval", {}).get("gates", {})
    if not isinstance(gates, dict) or name not in gates:
        raise EvidenceError(f"Unknown evaluation gate: {name}")
    value = gates[name]
    if type(value) is bool:
        # Preserve the former declaration without pretending it selected a model.
        value = {"mode": "replay" if name == "pr" else "native-host", "blocking": value,
                 "require_all_packs": name == "pr", "controls": ["completion-only", "interrupted"]}
    if not isinstance(value, dict) or value.get("mode") not in ("replay", "native-host"):
        raise EvidenceError(f"Gate {name} needs an explicit replay or native-host mode")
    allowed = {"mode", "blocking", "require_all_packs", "controls", "minimum_repetitions", "require_paired_variants"}
    if set(value) - allowed:
        raise EvidenceError(f"Gate {name} has unknown options: {sorted(set(value) - allowed)}")
    if type(value.get("blocking")) is not bool:
        raise EvidenceError(f"Gate {name}.blocking must be boolean")
    for key in ("require_all_packs", "require_paired_variants"):
        if key in value and type(value[key]) is not bool:
            raise EvidenceError(f"Gate {name}.{key} must be boolean")
    controls = value.get("controls", [])
    if (not isinstance(controls, list) or any(not isinstance(control, str) for control in controls)
            or len(controls) != len(set(controls))
            or any(c not in ("completion-only", "interrupted") for c in controls)):
        raise EvidenceError(f"Gate {name} has invalid controls")
    repeats = value.get("minimum_repetitions", 1)
    if type(repeats) is not int or not 1 <= repeats <= 20:
        raise EvidenceError(f"Gate {name}.minimum_repetitions must be an integer in [1, 20]")
    if value["mode"] == "replay" and value["blocking"] and set(controls) != {"completion-only", "interrupted"}:
        raise EvidenceError("A blocking replay gate requires completion-only and interrupted controls")
    return dict(value)
