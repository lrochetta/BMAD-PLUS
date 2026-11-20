"""Immutable eval inputs and bounded, portable file access (stdlib only).

These checks constrain this harness's reads and writes. They are not an OS
sandbox for an external host or for code executed by an assertion.
"""

from __future__ import annotations

import hashlib
import json
import os
import stat
import subprocess
from dataclasses import asdict, dataclass
from pathlib import Path

MAX_FILE_BYTES = 256 * 1024
MAX_TOTAL_BYTES = 2 * 1024 * 1024
MAX_FILES = 200
MAX_RESOURCE_BYTES = 128 * 1024
MAX_CONTEXT_BYTES = 512 * 1024


class EvidenceError(ValueError):
    """An input or workspace cannot be represented safely and completely."""


def sha256(value: bytes | str) -> str:
    return hashlib.sha256(value.encode("utf-8") if isinstance(value, str) else value).hexdigest()


def object_hash(value) -> str:
    return sha256(json.dumps(value, sort_keys=True, ensure_ascii=False, separators=(",", ":"), allow_nan=False))


def safe_relative(value: str, *, allow_root: bool = False) -> bool:
    if allow_root and value == ".":
        return True
    if not isinstance(value, str) or not value or value != value.strip():
        return False
    # POSIX separators are the portable spec format. Reject Windows drive,
    # UNC, alternate stream, reserved device and trailing-dot aliases on Linux
    # too, so a spec does not become unsafe merely by moving to Windows.
    if "\\" in value or any(ch in value for ch in ':\x00<>"|?*') or any(ord(ch) < 32 for ch in value):
        return False
    parts = value.split("/")
    reserved = {"CON", "PRN", "AUX", "NUL", *(f"COM{i}" for i in range(1, 10)), *(f"LPT{i}" for i in range(1, 10))}
    return all(part not in ("", ".", "..") and part[-1:] not in (".", " ")
               and part.split(".")[0].upper() not in reserved for part in parts)


def reject_link(path: Path) -> None:
    info = path.lstat()
    if stat.S_ISLNK(info.st_mode) or getattr(info, "st_file_attributes", 0) & getattr(stat, "FILE_ATTRIBUTE_REPARSE_POINT", 0x400):
        raise EvidenceError(f"symlink/junction/reparse point is not allowed: {path}")


def explicit_root(root: Path) -> Path:
    root = Path(os.path.abspath(root))
    # Do not resolve away evidence of a linked root or ancestor.
    for parent in reversed((root, *root.parents)):
        reject_link(parent)
    if not root.is_dir():
        raise EvidenceError(f"explicit root is not a directory: {root}")
    return root


def resolve_inside(root: Path, relative: str, *, kind: str = "file", missing: bool = False) -> Path:
    root = explicit_root(root)
    if not safe_relative(relative, allow_root=kind == "directory"):
        raise EvidenceError(f"unsafe relative path: {relative!r}")
    current = root
    for part in (() if relative == "." else relative.split("/")):
        if not current.is_dir():
            if missing and not current.exists():
                current /= part
                continue
            raise EvidenceError(f"path parent is not a directory: {current}")
        names = [entry.name for entry in current.iterdir()]
        if part not in names:
            if any(name.casefold() == part.casefold() for name in names):
                raise EvidenceError(f"path case mismatch: {relative!r}")
            if not missing:
                raise EvidenceError(f"missing {kind}: {relative!r}")
            current /= part
            continue
        current /= part
        reject_link(current)
    if not current.resolve(strict=False).is_relative_to(root.resolve()):
        raise EvidenceError(f"path escaped explicit root: {relative!r}")
    if current.exists():
        if kind == "file" and not current.is_file():
            raise EvidenceError(f"expected a regular file: {relative!r}")
        if kind == "directory" and not current.is_dir():
            raise EvidenceError(f"expected a directory: {relative!r}")
        if kind not in ("file", "directory") and not (current.is_file() or current.is_dir()):
            raise EvidenceError(f"expected a regular file or directory: {relative!r}")
    elif not missing:
        raise EvidenceError(f"missing {kind}: {relative!r}")
    return current


@dataclass(frozen=True)
class FileRecord:
    path: str
    sha256: str
    size_bytes: int
    content: str

    def evidence(self) -> dict:
        return {"path": self.path, "sha256": self.sha256, "size_bytes": self.size_bytes}


def read_record(root: Path, relative: str, *, limit: int = MAX_FILE_BYTES) -> FileRecord:
    path = resolve_inside(root, relative)
    if path.stat().st_size > limit:
        raise EvidenceError(f"file exceeds {limit} bytes: {relative}")
    raw = path.read_bytes()
    if len(raw) > limit:
        raise EvidenceError(f"file exceeds {limit} bytes: {relative}")
    try:
        content = raw.decode("utf-8")
    except UnicodeDecodeError as exc:
        raise EvidenceError(f"file is not UTF-8: {relative}") from exc
    if "\x00" in content:
        raise EvidenceError(f"binary/NUL content is not supported: {relative}")
    return FileRecord(relative, sha256(raw), len(raw), content)


def snapshot(root: Path) -> tuple[FileRecord, ...]:
    root = explicit_root(root)
    records = []
    total = 0
    for current, dirs, files in os.walk(root, followlinks=False):
        for name in (*dirs, *files):
            reject_link(Path(current) / name)
        for name in sorted(files):
            relative = (Path(current) / name).relative_to(root).as_posix()
            record = read_record(root, relative)
            records.append(record)
            total += record.size_bytes
            if len(records) > MAX_FILES or total > MAX_TOTAL_BYTES:
                raise EvidenceError(f"workspace exceeds {MAX_FILES} files or {MAX_TOTAL_BYTES} bytes")
    return tuple(sorted(records, key=lambda record: record.path))


def manifest(records: tuple[FileRecord, ...]) -> dict:
    files = [record.evidence() for record in records]
    return {"sha256": object_hash(files), "files": files}


def revision(root: Path) -> str | None:
    """Only report a revision for an actual Git workspace, never its parent."""
    if not (root / ".git").exists():
        return None
    try:
        process = subprocess.run(["git", "-C", str(root), "rev-parse", "--verify", "HEAD"],
                                 capture_output=True, text=True, timeout=5, shell=False)
    except (OSError, subprocess.TimeoutExpired):
        return None
    value = process.stdout.strip()
    return value if process.returncode == 0 and len(value) in (40, 64) else None


@dataclass(frozen=True)
class PreparedContext:
    system: str
    prompt: str
    resources: tuple[FileRecord, ...]
    fixture_files: tuple[FileRecord, ...]
    spec_sha256: str
    context_sha256: str
    execution_mode: str
    source_root: str
    workspace_root: str
    context_variant: str = "agent"
    source_revision: str | None = None
    baseline_revision: str | None = None

    def evidence(self) -> dict:
        return {
            "spec_sha256": self.spec_sha256,
            "context_sha256": self.context_sha256,
            "system_sha256": sha256(self.system), "prompt_sha256": sha256(self.prompt),
            "resources": [record.evidence() for record in self.resources],
            "fixture": manifest(self.fixture_files),
            "execution_mode": self.execution_mode,
            "context_variant": self.context_variant,
            "source_revision": self.source_revision, "baseline_revision": self.baseline_revision,
        }

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, value: dict) -> "PreparedContext":
        # The immutable digest includes the complete spec (including held-out
        # acceptance declarations) and every actual provider input byte.
        copy = dict(value)
        for key in ("resources", "fixture_files"):
            copy[key] = tuple(FileRecord(**entry) for entry in copy[key])
        context = cls(**copy)
        verify_context(context)
        return context


def verify_context(context: PreparedContext) -> None:
    if context.execution_mode not in ("mock", "rendered-response", "native-host"):
        raise EvidenceError("unknown prepared execution mode")
    if context.context_variant not in ("agent", "generic-control"):
        raise EvidenceError("unknown prepared context variant")
    if context.context_variant == "agent" and not context.resources:
        raise EvidenceError("selected-agent context has no resources")
    if context.context_variant == "generic-control" and context.resources:
        raise EvidenceError("generic-control must not include selected-agent resources")
    if len(context.resources) > MAX_FILES or len(context.fixture_files) > MAX_FILES:
        raise EvidenceError("prepared context exceeds the file-count budget")
    if len((context.system + context.prompt).encode("utf-8")) > MAX_TOTAL_BYTES:
        raise EvidenceError("prepared input exceeds the byte budget")
    for record in (*context.resources, *context.fixture_files):
        if not safe_relative(record.path):
            raise EvidenceError(f"unsafe prepared resource path: {record.path}")
        if sha256(record.content) != record.sha256 or len(record.content.encode("utf-8")) != record.size_bytes:
            raise EvidenceError(f"prepared content hash mismatch: {record.path}")
    expected = object_hash({
        "system": context.system, "prompt": context.prompt,
        "resources": [record.evidence() for record in context.resources],
        "fixture": manifest(context.fixture_files), "spec_sha256": context.spec_sha256,
        "execution_mode": context.execution_mode,
        "context_variant": context.context_variant,
        "source_revision": context.source_revision, "baseline_revision": context.baseline_revision,
    })
    if expected != context.context_sha256:
        raise EvidenceError("prepared context hash mismatch")
