"""Bounded assertion output without waiting for inherited pipes to close.

No communicate() call or background reader thread can extend the deadline.
Only the Popen-owned direct child is killed/reaped; this is not a process-tree
sandbox and descendant termination is deliberately left unverified.
"""

from __future__ import annotations

import hashlib
import math
import os
import subprocess
import time

MAX_OUTPUT_BYTES = 2 * 1024 * 1024
CHUNK_BYTES = 16 * 1024
TAIL_BYTES = 16 * 1024
EXCERPT_CHARS = 4000
POLL_SECONDS = 0.01
REAP_SECONDS = 1.0


class _Pipe:
    def __init__(self, stream):
        self.stream = stream
        self.fd = stream.fileno()
        if os.name == "nt":
            import ctypes
            import msvcrt
            from ctypes import wintypes

            self.ctypes = ctypes
            self.handle = wintypes.HANDLE(msvcrt.get_osfhandle(self.fd))
            self.available = wintypes.DWORD()
            self.peek = ctypes.WinDLL("kernel32", use_last_error=True).PeekNamedPipe
            self.peek.argtypes = (wintypes.HANDLE, ctypes.c_void_p, wintypes.DWORD,
                                  ctypes.c_void_p, ctypes.POINTER(wintypes.DWORD), ctypes.c_void_p)
            self.peek.restype = wintypes.BOOL
        else:
            os.set_blocking(self.fd, False)

    def read_ready(self, maximum: int) -> bytes | None:
        if os.name == "nt":
            if not self.peek(self.handle, None, 0, None, self.ctypes.byref(self.available), None):
                error = self.ctypes.get_last_error()
                if error in (109, 233):  # broken/disconnected pipe: every writer closed
                    return b""
                raise OSError(error, "Cannot inspect assertion output pipe")
            if not self.available.value:
                return None
            maximum = min(maximum, self.available.value)
        # There is exactly one reader. Windows PeekNamedPipe provides the byte
        # count; POSIX nonblocking reads return EAGAIN while a writer is idle.
        try:
            return os.read(self.fd, maximum)
        except BlockingIOError:
            return None


class _CapturedStream:
    def __init__(self, stream):
        self.pipe = _Pipe(stream)
        self.hash = hashlib.sha256()
        self.captured = 0
        self.observed = 0
        self.tail = b""
        self.eof = False

    def drain(self, remaining: int) -> bool | None:
        data = self.pipe.read_ready(min(CHUNK_BYTES, remaining + 1))
        if data is None:
            return None
        if not data:
            self.eof = True
            return False
        self.observed += len(data)
        kept = data[:remaining]
        self.hash.update(kept)
        self.captured += len(kept)
        self.tail = (self.tail + kept)[-TAIL_BYTES:]
        return len(data) > remaining

    def evidence(self, name: str) -> dict:
        text = self.tail.decode("utf-8", errors="replace")
        complete = self.eof and self.observed == self.captured
        return {
            name: text[-EXCERPT_CHARS:],
            f"{name}_sha256": self.hash.hexdigest(),
            f"{name}_captured_bytes": self.captured,
            f"{name}_observed_bytes": self.observed,
            f"{name}_capture_complete": complete,
            f"{name}_truncated": not complete,
            f"{name}_digest_scope": "complete-stream" if complete else "captured-prefix",
            f"{name}_excerpted": self.captured > len(self.tail) or len(text) > EXCERPT_CHARS,
        }


def capture_command(argv: list[str], *, cwd, env: dict, timeout_s: float,
                    output_limit_bytes: int = MAX_OUTPUT_BYTES) -> dict:
    """Drain at most a combined byte cap, then stop with explicit partial evidence.

    At most one extra byte is read to distinguish a full stream exactly at the
    limit from excess output. It is counted as observed, not hashed as captured.
    Hashes describe exactly the captured bytes, never an unobserved full stream.
    On cap, timeout or read error, the bounded reaping grace applies only to the
    direct child. Closing read handles requires no thread join or EOF wait.
    """
    if type(timeout_s) not in (int, float) or not math.isfinite(timeout_s) or timeout_s <= 0:
        raise ValueError("command timeout must be a finite positive number")
    if type(output_limit_bytes) is not int or output_limit_bytes <= 0:
        raise ValueError("command output limit must be a positive byte count")
    started = time.monotonic()
    process = subprocess.Popen(argv, cwd=cwd, env=env, shell=False, stdin=subprocess.DEVNULL,
                               stdout=subprocess.PIPE, stderr=subprocess.PIPE, bufsize=0,
                               close_fds=True)
    streams = {}
    reason, read_error = None, None
    kill_attempted, kill_error = False, None
    try:
        streams = {"stdout": _CapturedStream(process.stdout), "stderr": _CapturedStream(process.stderr)}
        deadline = started + timeout_s
        while True:
            if time.monotonic() >= deadline:
                reason = "timeout"
                break
            activity = False
            for capture in streams.values():
                if capture.eof:
                    continue
                remaining = output_limit_bytes - sum(item.captured for item in streams.values())
                exceeded = capture.drain(remaining)
                activity |= exceeded is not None
                if exceeded:
                    reason = "output-limit"
                    break
            if reason:
                break
            if all(capture.eof for capture in streams.values()) and process.poll() is not None:
                break
            if not activity:
                time.sleep(min(POLL_SECONDS, max(0, deadline - time.monotonic())))
    except OSError as exc:
        reason, read_error = "capture-error", str(exc)
    finally:
        # Popen owns the live process handle/PID; do not enumerate or kill by
        # process name. Its descendants are outside this collector's ownership.
        if process.poll() is None:
            kill_attempted = True
            try:
                process.kill()
            except OSError as exc:
                kill_error = str(exc)
        try:
            process.wait(timeout=REAP_SECONDS)
        except subprocess.TimeoutExpired:
            if reason is None:
                reason = "reap-timeout"
        for pipe in (process.stdout, process.stderr):
            pipe.close()
    evidence = {
        "exit_code": process.returncode, "direct_child_pid": process.pid,
        "timed_out": reason == "timeout", "output_limit_exceeded": reason == "output-limit",
        "capture_failure": reason, "capture_error": read_error,
        "output_limit_bytes": output_limit_bytes, "reap_grace_s": REAP_SECONDS,
        "direct_child_kill_attempted": kill_attempted, "direct_child_kill_error": kill_error,
        "direct_child_reaped": process.returncode is not None,
        "descendant_termination_verified": False,
    }
    for name, capture in streams.items():
        evidence.update(capture.evidence(name))
    evidence["output_capture_complete"] = len(streams) == 2 and all(
        evidence[f"{name}_capture_complete"] for name in streams)
    evidence["output_truncated"] = not evidence["output_capture_complete"]
    evidence["output_excerpted"] = any(evidence[f"{name}_excerpted"] for name in streams)
    return evidence
