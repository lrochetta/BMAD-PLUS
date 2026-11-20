#!/usr/bin/env python3
"""Provider-neutral model gateway for the BMAD+ eval runner (Pillar 4 backend).

One tiny interface — ``Provider.generate(prompt) -> text`` — behind which every
model vendor lives. ``run.py`` never talks to a vendor API directly; it asks
``get_provider()`` for a provider and calls ``generate()``. That keeps the eval
harness multi-model by construction (registry.yaml ``targets.models_supported``)
and lets CI/tests run with the deterministic ``mock`` provider, which never
touches the network.

Selection (first match wins):
    1. explicit name passed to ``get_provider(name)``  (CLI ``--provider``)
    2. ``BMAD_EVAL_PROVIDER`` environment variable
    3. default: ``mock``

Providers:
    mock       deterministic echo/canned output — default; used by tests & CI.
    anthropic  Anthropic Messages API (stdlib urllib, no SDK dependency).
    openai     OpenAI Chat Completions API (stdlib urllib).
    http       any OpenAI-compatible chat endpoint (Gemini OpenAI-compat,
               Ollama, vLLM, LM Studio, llama.cpp server, ...).

No vendor SDK is imported and nothing here performs I/O at import time.
API keys are read from the environment at construction time only; a missing
key raises ``ProviderConfigError`` with the exact variable to set.

Docs: evals/_runner/README-backend.md
Author: Laurent Rochetta
"""

from __future__ import annotations

import hashlib
import json
import os
import urllib.error
import urllib.request
from pathlib import Path

DEFAULT_TIMEOUT_S = 300
DEFAULT_MAX_TOKENS = 8192

ENV_PROVIDER = "BMAD_EVAL_PROVIDER"
DEFAULT_PROVIDER = "mock"


class ProviderError(RuntimeError):
    """A provider failed at runtime (HTTP error, bad response shape, ...)."""


class ProviderConfigError(ProviderError):
    """A provider is misconfigured (missing key/URL/model). Fail fast + loud."""


# ─────────────────────────────────────────────────────────────────────────────
# Interface
# ─────────────────────────────────────────────────────────────────────────────

class Provider:
    """One text-generation backend. Subclasses implement ``generate``.

    Contract: ``generate`` is synchronous, takes a single user ``prompt``
    (plus optional ``system``), and returns the model's full text output.
    ``model`` is the *eval alias* from the spec (``claude``/``gpt``/``gemini``/
    ``local``); each provider maps it to a concrete vendor model id via
    ``BMAD_EVAL_MODEL_<ALIAS>`` or its own default.
    """

    name = "base"

    def describe_call(self, model=None, *, timeout_s=DEFAULT_TIMEOUT_S,
                      max_tokens=DEFAULT_MAX_TOKENS) -> dict:
        """Effective, non-secret request settings; no estimated usage/cost.

        Custom providers can override this when their concrete model is known.
        A missing value stays unknown instead of being inferred from an alias.
        """
        env = getattr(self, "_env", {})
        concrete = _alias_model_override(model, env) or getattr(self, "_default_model", None)
        return {
            "provider": self.name, "model_alias": model,
            "concrete_model": concrete,
            "execution_mode": "mock" if self.name == "mock" else "rendered-response",
            "effective_settings": {"timeout_s": timeout_s, "max_tokens": max_tokens,
                                   "temperature": None},
            "usage": None, "cost": None,
        }

    def record_response(self, data: dict) -> None:
        """Keep only observed, non-secret response metadata from this call."""
        usage = data.get("usage") if isinstance(data, dict) else None
        self.last_response = {
            "response_id": data.get("id"), "response_model": data.get("model"),
            "usage": usage if isinstance(usage, dict) else None,
            "cost": None,
        }
        stop = data.get("stop_reason")
        choices = data.get("choices") or []
        if choices and isinstance(choices[0], dict):
            stop = choices[0].get("finish_reason")
        self.last_response.update({"stop_reason": stop,
                                   "completed": stop not in ("max_tokens", "length", "refusal", "content_filter", "tool_calls", "tool_use", "function_call")})

    def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        model: str | None = None,
        timeout_s: int = DEFAULT_TIMEOUT_S,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> str:
        raise NotImplementedError


def _alias_model_override(alias: str | None, env) -> str | None:
    """Per-alias model override: BMAD_EVAL_MODEL_CLAUDE, BMAD_EVAL_MODEL_GPT, ..."""
    if not alias:
        return None
    key = "BMAD_EVAL_MODEL_" + alias.upper().replace("-", "_")
    return env.get(key) or None


def _post_json(url: str, payload: dict, headers: dict, timeout_s: int) -> dict:
    """POST JSON, return parsed JSON. All network errors -> ProviderError."""
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        url, data=data, method="POST",
        headers={"content-type": "application/json", **headers},
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout_s) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        try:
            body = exc.read().decode("utf-8", errors="replace")[:500]
        except Exception:  # pragma: no cover
            body = ""
        raise ProviderError(f"{url} -> HTTP {exc.code}: {body}") from exc
    except urllib.error.URLError as exc:
        raise ProviderError(f"{url} unreachable: {exc.reason}") from exc


# ─────────────────────────────────────────────────────────────────────────────
# Mock provider — default; deterministic; zero network
# ─────────────────────────────────────────────────────────────────────────────

class MockProvider(Provider):
    """Deterministic offline provider used by --self-check, tests, and CI.

    Response resolution order:
      1. ``script`` constructor arg — a str (canned response) or a callable
         ``(prompt) -> str`` (tests inject exact transcripts this way).
      2. ``BMAD_EVAL_MOCK_RESPONSE_FILE`` — path to a file whose content is
         returned verbatim (lets you replay a saved transcript through the
         whole scoring pipeline offline).
      3. Deterministic echo: a tagged header (with the prompt's sha256 prefix)
         followed by the prompt itself. Same prompt -> same output, always.
    """

    name = "mock"

    def __init__(self, script=None, env=None):
        env = os.environ if env is None else env
        self._script = script
        self._response_file = env.get("BMAD_EVAL_MOCK_RESPONSE_FILE", "")

    def describe_call(self, model=None, **kwargs):
        metadata = super().describe_call(model, **kwargs)
        metadata["replay"] = bool(self._response_file)
        metadata["concrete_model"] = None
        return metadata

    def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        model: str | None = None,
        timeout_s: int = DEFAULT_TIMEOUT_S,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> str:
        if callable(self._script):
            return self._script(prompt)
        if isinstance(self._script, str):
            return self._script
        if self._response_file:
            return Path(self._response_file).read_text(encoding="utf-8")
        digest = hashlib.sha256(prompt.encode("utf-8")).hexdigest()[:12]
        return (
            f"[bmad-eval mock provider | model={model or 'default'} "
            f"| prompt-sha256={digest}]\n{prompt}"
        )


# ─────────────────────────────────────────────────────────────────────────────
# Anthropic — Messages API via stdlib urllib (no SDK dependency)
# ─────────────────────────────────────────────────────────────────────────────

class AnthropicProvider(Provider):
    """Anthropic Messages API. Requires ANTHROPIC_API_KEY.

    Model id: BMAD_EVAL_MODEL_<ALIAS> > ANTHROPIC_MODEL > claude-opus-4-8.
    Endpoint override: ANTHROPIC_BASE_URL (e.g. a corporate proxy).
    """

    name = "anthropic"
    DEFAULT_MODEL = "claude-opus-4-8"
    ANTHROPIC_VERSION = "2023-06-01"

    def __init__(self, env=None):
        env = os.environ if env is None else env
        self._env = env
        self._api_key = env.get("ANTHROPIC_API_KEY", "")
        if not self._api_key:
            raise ProviderConfigError(
                "anthropic provider: set ANTHROPIC_API_KEY (see README-backend.md)"
            )
        base = (env.get("ANTHROPIC_BASE_URL") or "https://api.anthropic.com").rstrip("/")
        self._url = f"{base}/v1/messages"
        self._default_model = env.get("ANTHROPIC_MODEL") or self.DEFAULT_MODEL

    def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        model: str | None = None,
        timeout_s: int = DEFAULT_TIMEOUT_S,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> str:
        model_id = _alias_model_override(model, self._env) or self._default_model
        payload: dict = {
            "model": model_id,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }
        if system:
            payload["system"] = system
        data = _post_json(
            self._url, payload,
            {"x-api-key": self._api_key, "anthropic-version": self.ANTHROPIC_VERSION},
            timeout_s,
        )
        self.record_response(data)
        blocks = data.get("content") or []
        text = "".join(b.get("text", "") for b in blocks if b.get("type") == "text")
        if not text and data.get("stop_reason") == "refusal":
            raise ProviderError("anthropic provider: request was refused (stop_reason=refusal)")
        return text


# ─────────────────────────────────────────────────────────────────────────────
# OpenAI — Chat Completions via stdlib urllib
# ─────────────────────────────────────────────────────────────────────────────

class OpenAIProvider(Provider):
    """OpenAI Chat Completions API. Requires OPENAI_API_KEY.

    Model id: BMAD_EVAL_MODEL_<ALIAS> > OPENAI_MODEL (required — no vendor
    model id is hardcoded here so the repo never ships a stale one).
    Endpoint override: OPENAI_BASE_URL (default https://api.openai.com/v1).
    """

    name = "openai"

    def __init__(self, env=None):
        env = os.environ if env is None else env
        self._env = env
        self._api_key = env.get("OPENAI_API_KEY", "")
        if not self._api_key:
            raise ProviderConfigError(
                "openai provider: set OPENAI_API_KEY (see README-backend.md)"
            )
        base = (env.get("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/")
        self._url = f"{base}/chat/completions"
        self._default_model = env.get("OPENAI_MODEL", "")

    def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        model: str | None = None,
        timeout_s: int = DEFAULT_TIMEOUT_S,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> str:
        model_id = _alias_model_override(model, self._env) or self._default_model
        if not model_id:
            raise ProviderConfigError(
                "openai provider: set OPENAI_MODEL (or BMAD_EVAL_MODEL_"
                f"{(model or 'gpt').upper()}) to a concrete model id"
            )
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        payload = {"model": model_id, "messages": messages, "max_tokens": max_tokens}
        data = _post_json(
            self._url, payload,
            {"authorization": f"Bearer {self._api_key}"},
            timeout_s,
        )
        self.record_response(data)
        return _extract_chat_completion_text(data, self.name)


class HTTPProvider(Provider):
    """Generic OpenAI-compatible chat endpoint — the escape hatch that keeps
    the harness vendor-neutral: Gemini's OpenAI-compat endpoint, Ollama,
    vLLM, LM Studio, llama.cpp server, any internal gateway.

    Required: BMAD_EVAL_HTTP_URL — full URL of a /chat/completions-shaped
    endpoint. Optional: BMAD_EVAL_HTTP_KEY (Bearer token),
    BMAD_EVAL_HTTP_MODEL (many local servers ignore/imply the model).
    """

    name = "http"

    def __init__(self, env=None):
        env = os.environ if env is None else env
        self._env = env
        self._url = env.get("BMAD_EVAL_HTTP_URL", "")
        if not self._url:
            raise ProviderConfigError(
                "http provider: set BMAD_EVAL_HTTP_URL to an OpenAI-compatible "
                "chat-completions endpoint (see README-backend.md)"
            )
        self._api_key = env.get("BMAD_EVAL_HTTP_KEY", "")
        self._default_model = env.get("BMAD_EVAL_HTTP_MODEL", "")

    def generate(
        self,
        prompt: str,
        *,
        system: str | None = None,
        model: str | None = None,
        timeout_s: int = DEFAULT_TIMEOUT_S,
        max_tokens: int = DEFAULT_MAX_TOKENS,
    ) -> str:
        model_id = _alias_model_override(model, self._env) or self._default_model
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        payload: dict = {"messages": messages, "max_tokens": max_tokens}
        if model_id:
            payload["model"] = model_id
        headers = {}
        if self._api_key:
            headers["authorization"] = f"Bearer {self._api_key}"
        data = _post_json(self._url, payload, headers, timeout_s)
        self.record_response(data)
        return _extract_chat_completion_text(data, self.name)


def _extract_chat_completion_text(data: dict, provider_name: str) -> str:
    """choices[0].message.content, defensively."""
    try:
        choices = data["choices"]
        content = choices[0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise ProviderError(
            f"{provider_name} provider: unexpected response shape "
            f"(keys: {sorted(data) if isinstance(data, dict) else type(data).__name__})"
        ) from exc
    return content or ""


# ─────────────────────────────────────────────────────────────────────────────
# Registry + selection
# ─────────────────────────────────────────────────────────────────────────────

PROVIDERS = {
    "mock": MockProvider,
    "anthropic": AnthropicProvider,
    "openai": OpenAIProvider,
    "http": HTTPProvider,
}


def get_provider(name: str | None = None, env=None) -> Provider:
    """Resolve + construct a provider. name > $BMAD_EVAL_PROVIDER > mock."""
    env = os.environ if env is None else env
    resolved = (name or env.get(ENV_PROVIDER) or DEFAULT_PROVIDER).strip().lower()
    factory = PROVIDERS.get(resolved)
    if factory is None:
        raise ProviderConfigError(
            f"unknown provider {resolved!r} (available: {sorted(PROVIDERS)})"
        )
    return factory(env=env)
