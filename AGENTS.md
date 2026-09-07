# AGENTS.md

## 1. Project Overview

A Spotify-powered music guessing game: authenticate → browse playlists → generate quiz → play previews → guess within 10s → score by correctness + speed → Solo / Party / Online Multiplayer → leaderboard → results.

Must feel like a polished consumer music game — not a SaaS dashboard, Spotify clone, AI-generated template, or over-engineered enterprise app.

**This file governs how you work.** For *what* to build, read:
- `PRD.md` — product scope, features, constraints
- `GAMEPLAY.md` — gameplay rules, scoring, state machine, invariants
- `DESIGN.md` — visual system
- `TECHNICAL.md` — stack, architecture, security, API design

Don't duplicate those rules here — this file is only about *process and code quality*.

---

## 2. Core Loop & Priority

```
Choose Music → Start → Listen → Guess → Score → Next Round → Repeat
```

Every change should serve this loop. Don't add complexity that doesn't improve gameplay, reliability, performance, UX, sync, or maintainability.

---

## 3. Source of Truth Priority

```
1. Explicit user requirements
2. Existing project architecture
3. PRD.md
4. GAMEPLAY.md
5. DESIGN.md
6. Existing implementation
7. General engineering judgment
```

If requirements conflict, don't silently pick one — surface the conflict and resolve toward the explicit product requirement.

---

## 4. Development Philosophy

Build incrementally: **Understand → Plan → Implement → Run → Test → Inspect → Fix → Refactor.** Every phase should leave the app in a working state — don't accumulate large blocks of untested code.

**Before writing code**: inspect existing structure, find relevant files, understand current architecture, check for existing components/utilities/types/API integrations before creating new ones, check env vars, check current error/loading handling, decide client vs. server vs. both.

**Avoid unnecessary rewrites**: prefer a small targeted change over a large rewrite unless the existing architecture genuinely blocks the requirement. Understand why something exists before replacing it.

---

## 5. Architecture Layering

```
UI → Application Logic → Game Logic → Data/API Layer
```

UI components stay light on business logic. Game logic stays decoupled from visual components. Spotify calls stay isolated to `lib/spotify/` (see TECHNICAL.md §9) — never scattered through UI.

---

## 6. Spotify-Specific Practices

- Official documented APIs only — no scraping, no undocumented endpoints.
- Normalize all Spotify responses into internal types (`GameTrack`, etc.) — never pass raw API objects through the app (TECHNICAL.md §8).
- Two distinct auth flows are required, not one — see PRD §5.1 / TECHNICAL.md §9. Don't default to only Authorization Code and assume it covers public playlists.
- `preview_url` reliability is a known risk (PRD §9) — filter unusable tracks before they ever reach quiz generation, never mid-game.
- Prepare the full question pool before gameplay starts — don't fetch per-round (GAMEPLAY.md §7).

---

## 7. Type Safety & Error Handling

Prefer strong typing; avoid `any` — use `unknown` for unvalidated external data until it's checked. Never disable TypeScript checks just to unblock a build.

Never silently swallow errors (`catch { /* ignore */ }` needs a documented reason). Provide logging where appropriate, user-facing feedback where appropriate, and a recovery path where possible. Never log tokens, secrets, or sensitive session data.

---

## 8. Component & State Design

Single-responsibility components — split Spotify calls / question generation / scoring / realtime handling / timer / audio / JSX into separate concerns rather than one giant page component (see TECHNICAL.md §6 for the reference structure).

Use the simplest state solution that fits — local state for modals/forms/temporary UI, don't reach for a heavy state library by default. Online game state always comes from the authoritative server (GAMEPLAY.md §21-24) — never reconstructed purely client-side.

---

## 9. Dependency Policy

Before adding a dependency, ask: Is it actually necessary? Can existing deps solve it? Does it work with Vercel? Does it meaningfully bloat the bundle? Is it maintained? Does it add unneeded complexity? — don't add a dependency for a trivial utility.

---

## 10. Code Quality

**Prefer**: small functions, clear names, explicit types, predictable state, reusable utilities, simple control flow, clear error handling.
**Avoid**: giant functions, deep nesting, magic numbers, duplicate logic, unclear names, dead code, commented-out old implementations.

**Naming**: descriptive (`currentRound`, `responseTime`, `correctTrackId`) — avoid `x`, `data`, `temp`, `foo` outside genuinely obvious scope.

**Comments**: explain *why*, not *what*. Don't comment everything.

**No AI slop**: no unnecessary abstractions, generic "BaseComponent" systems, over-engineered state machines, unused config layers, or duplicate API clients "just in case." Boring, understandable code that solves the actual problem wins.

**No faked functionality**: never fake Spotify data, multiplayer sync, scores, room state, or a hardcoded leaderboard to make the UI look done. An explicit "feature unavailable" beats a fake success. Dev-only mocks are fine if clearly isolated and guaranteed not to leak into production paths.

---

## 11. Testing Priorities

Game logic should be testable independent of UI. Prioritize: scoring, answer validation, question generation, dedup, timer boundaries, round progression, state transitions, multiplayer answer locking. Randomized functions should accept an injectable RNG for determinism. See GAMEPLAY.md §18-20 for exact scoring test values and §51 for invariants to assert against.

**Edge cases to always consider**:
- *Spotify*: playlist not found/empty/too small, track without preview, expired auth, rate limits.
- *Gameplay*: timer hits zero, answer at the exact deadline, double-click, duplicate/insufficient tracks, audio failure.
- *Multiplayer*: player/host disconnect, room disappears, simultaneous answers, reconnection, latency, game finishing mid-request.

---

## 12. Validation Workflow

Never claim a feature works without testing it. If validation can't be run, say explicitly *"Not verified because..."* — don't imply it was checked.

For UI: verify desktop + mobile layout, interaction/loading/error/empty states, keyboard nav where relevant.
For gameplay: verify audio starts, timer works, answers lock correctly, scores update, round/final transitions work.
For multiplayer, minimum smoke test:
```
A creates room → B joins → game starts → both get same question →
both answer → scores calculated → next round → final leaderboard
```
Plus: disconnect, host disconnect, reconnect, timer expiry, double-submit.

---

## 13. UI Implementation Order

Build **hierarchy → layout → typography → spacing → interaction states → motion → decorative details, last.** Never start with decoration. During gameplay, priority is always: `Gameplay > Navigation > Decoration > Analytics > Branding` — the player must identify song/timer/choices/score/round at a glance (see DESIGN.md).

---

## 14. Git & Change Discipline

Focused commits, not mixed unrelated changes:
```
feat: add Spotify playlist selection
fix: prevent duplicate answer submissions
```
not `update stuff` / `fix` / `final final`.

Don't refactor unrelated code while fixing something else — if a broader refactor is genuinely needed, explain why first.

Update docs when behavior changes (`GAMEPLAY.md` for rule changes, `DESIGN.md` for visual system changes, `PRD.md` for scope changes) — don't leave docs describing behavior that no longer exists.

---

## 15. Agent Workflow

1. **Inspect** — understand the current codebase.
2. **Plan** — files to touch/create, deps needed, API/state implications, testing needs.
3. **Implement** — smallest coherent change that satisfies the requirement.
4. **Validate** — typecheck, lint, tests, build (only scripts that actually exist).
5. **Inspect** — UI, console, network, runtime behavior, responsiveness.
6. **Fix** — resolve anything found in validation.
7. **Summarize** — what changed, why, files affected, what was tested, known limitations.

---

## 16. Product Quality Bar

Should feel: fast, reliable, polished, competitive, social, music-focused, intuitive.
Should never feel: over-engineered, generic, AI-generated, cluttered, slow, fragile.

---

## 17. Final Rule

When uncertain, prefer:
```
Simple        > Complex
Reliable      > Fancy
Fast          > Decorative
Explicit      > Magic
Maintainable  > Clever
User Experience > Developer Convenience
```

The goal isn't the most technically impressive system — it's a music guessing game people actually enjoy playing with their friends.