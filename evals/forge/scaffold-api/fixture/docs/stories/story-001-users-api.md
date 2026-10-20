# Story 001 — Users JSON API (scaffold)

Status: Ready for Dev
Epic: eval-fixture (synthetic)

## Story

As an API consumer, I want a minimal in-memory users HTTP JSON API so that the
frontend team can integrate against a stable contract before the real database
lands.

## Acceptance Criteria

- AC-1: `GET /users` returns `200` with a JSON array of users (initially empty).
- AC-2: `POST /users` with JSON body `{ "name": string, "email": string }`
  returns `201` and the created user including a generated `id`.
- AC-3: `POST /users` with a missing or invalid `email` (no `@`) returns `400`
  with a JSON error message.
- AC-4: Unit tests cover AC-1 through AC-3 and pass with `node --test`.

## Tasks / Subtasks

- [ ] Task 1: Create `src/server.js` exporting `createServer()` built on
  `node:http`. It must NOT call `.listen()` at import time (AC-1).
- [ ] Task 2: Create `src/routes/users.js` with an in-memory store and the
  request handlers, including email validation (AC-1, AC-2, AC-3).
- [ ] Task 3: Create `tests/users.test.js` using `node:test` + `node:assert`
  covering AC-1, AC-2, AC-3 (AC-4).
- [ ] Task 4: Run `node --test tests/users.test.js` — all tests green before
  marking the story done.

## Dev Notes

- Runtime: Node >= 20, CommonJS modules.
- Stdlib ONLY: `node:http`, `node:test`, `node:assert`. No package.json, no
  npm installs.
- Keep it minimal — this is a scaffold, not the final service (Karpathy G2).
