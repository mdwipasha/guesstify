# TECHNICAL.md

## 1. Overview

Spotify-powered music guessing game, deployed on **Vercel**.

Priorities: Vercel compatibility · low ops complexity · secure Spotify auth · fast gameplay · reliable audio preview playback · real-time multiplayer sync · shared game logic (online/offline) · strong typing · minimal infra · good DX.

Avoid backend infra the platform already solves.

---

## 2. Stack

```
Frontend    : Astro + React + TypeScript + Tailwind CSS
Backend     : Vercel Server Functions (TypeScript)
Auth        : Spotify OAuth 2.0
Music Data  : Spotify Web API
Realtime    : Vercel-compatible realtime service
Deploy      : Vercel
```

Don't add deps just because they're popular. Stack may evolve if better solutions emerge.

---

## 3. Architecture

```
Browser (Astro/React UI, Audio Player)
        │ HTTPS / Realtime
   ┌────┴─────┐
Vercel API   Realtime Service
   │              │
Spotify API   Game State/Sessions
```

Keep it modular.

---

## 4. Frontend Responsibilities

Renders screens, handles interaction/audio/timer/animations, runs offline gameplay, displays server state, sends user actions.

**Not** responsible for authoritative multiplayer calculations.

- **Astro** → routing, layouts, SEO, static/SSR content, loads React islands.
- **React** → game screen, choices, timer, lobby, leaderboard, playlist picker, audio controls, dialogs.

Don't over-hydrate static pages; don't use React for static content.

---

## 5. TypeScript

Strict mode required (`"strict": true`). Never disable checks just to bypass problems. TS types are compile-time only — always validate at runtime too (see §14).

---

## 6. Project Structure

```
src/
├── components/  ├── layouts/     ├── pages/
├── lib/
│   ├── spotify/ ├── game/ ├── multiplayer/ ├── audio/ └── utils/
├── hooks/  ├── types/  └── styles/
```

Structure may adapt; separation of concerns is what matters.

---

## 7. Game Domain (`lib/game/`)

`scoring.ts · question-generator.ts · game-engine.ts · validation.ts · shuffle.ts · types.ts`

Keep logic pure/UI-independent so it's shared between offline and online modes.

### Scoring

```typescript
export function calculateScore(
  responseTime: number,
  timeLimit = 10,
  maxScore = 1000
): number {
  const t = Math.max(0, Math.min(responseTime, timeLimit));
  const score = maxScore * ((timeLimit - t) / timeLimit);
  return Math.max(0, Math.min(maxScore, Math.round(score)));
}
```
Test cases: `0s→1000, 1s→900, 5s→500, 9s→100, ≥10s→0, negative→clamped safely`.

### Question Generator

```
tracks → normalize → filter unusable → dedupe → shuffle
       → select N → generate 3 distractors → shuffle choices
```
Verify: 4 choices, 1 correct, no dupes, correct-answer position randomized.

---

## 8. Core Types

```typescript
export interface GameTrack {
  id: string; name: string; artist: string; album: string;
  artworkUrl: string | null; previewUrl: string | null;
}

export interface GameQuestion {
  id: string; trackId: string; trackName: string; artist: string; album: string;
  artworkUrl: string | null; previewUrl: string;
  choices: GameChoice[]; correctTrackId: string;
}

export interface GameChoice { trackId: string; title: string; }

export interface GamePlayer {
  id: string; displayName: string; avatarUrl?: string | null;
  score: number; correctAnswers: number; answered: boolean; responseTimes: number[];
}

export type GamePhase = "LOBBY" | "STARTING" | "ANSWERING" | "ROUND_RESULT" | "FINISHED";

export interface GameState {
  id: string; mode: "offline" | "online"; phase: GamePhase; hostId?: string;
  currentRound: number; totalRounds: number; roundStartedAt?: number;
  currentQuestion?: GameQuestion; players: GamePlayer[];
}
```

**Rule:** use a single `phase: GamePhase` enum, never scattered booleans (`isStarted/isPlaying/isFinished`).

**Rule:** never send `correctTrackId` to clients before they answer / round ends — server keeps it internal.

---

## 9. Spotify Integration (`lib/spotify/`)

`client.ts · auth.ts · playlists.ts · tracks.ts · users.ts · normalize.ts · types.ts`

Never call Spotify directly from UI components — go through this layer.

- **Auth**: standard OAuth flow (Connect → Authorize → Callback → Validate → Session). App never sees the user's Spotify password.
- **Storage**: server-managed sessions; never put `client_secret`/`refresh_token`/credentials in the browser or `localStorage`.
- **Token refresh**: check validity → refresh if expired → retry once (no infinite retry loops).
- **Errors**: map to `"UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "RATE_LIMITED" | "NETWORK" | "UNKNOWN"`.
- **Rate limiting**: fetch once → normalize → cache/reuse. No per-render/per-component requests.
- **Pagination**: handle multi-page playlists; stop once enough tracks are collected — don't over-fetch.
- **Preview URLs**: optional; exclude tracks with no preview before building questions.

---

## 10. Audio (`lib/audio/`)

`audio-player.ts · audio-manager.ts · types.ts` — handles load/play/pause/stop/reset/error/ended/volume.

Lifecycle: `question change → stop previous → load new → play → question ends → stop/reset`. Never play multiple previews simultaneously.

Browser autoplay is often blocked — unlock audio on a user gesture (e.g. "Start Game" click), don't assume autoplay works.

Don't preload every track at once — only current/upcoming, one controlled audio instance.

---

## 11. Timer

Derive remaining time from timestamps, not raw `setInterval` countdowns (which drift):

```
remainingTime = timeLimit - (currentTime - roundStartedAt)
```

Centralize constants:
```typescript
export const GAME_CONSTANTS = {
  ROUND_DURATION_MS: 10_000,
  MAX_SCORE: 1_000,
  ANSWER_CHOICES: 4,
} as const;
```

---

## 12. Online Multiplayer

Vercel functions can't host long-running WebSocket servers — pick a realtime provider evaluated on: Vercel compatibility, reliability, latency, cost, DX, scalability.

**Events, not raw state mutations:**
```
PLAYER_JOINED · ROUND_STARTED · ANSWER_SUBMITTED · ROUND_FINISHED · GAME_FINISHED
```
```typescript
type GameEvent =
  | { type: "PLAYER_JOINED"; player: PublicPlayer }
  | { type: "ROUND_STARTED"; round: number; question: PublicQuestion; startedAt: number }
  | { type: "ANSWER_SUBMITTED"; playerId: string }
  | { type: "ROUND_FINISHED"; results: RoundResult[] }
  | { type: "GAME_FINISHED"; leaderboard: LeaderboardEntry[] };
```

**Server-authoritative, always.** Clients send intents (`SUBMIT_ANSWER { trackId }`), never state (`SET_SCORE`).

**Room IDs**: random short codes (`A7KQ9`), never sequential (`ROOM-1`).

**Every room action validates**: room exists → player exists → player belongs to room → phase allows action → action itself is valid.

**Answer flow**: validate player → room → phase → not-already-answered → timer → trackId → determine correctness → score → persist → broadcast.

**Response time** = `serverReceivedAt - roundStartedAt`. Client never self-reports timing. Boundary cases (e.g. answer at 10.15s vs 9.85s) are decided server-side only.

---

## 13. Offline Mode

Same engine, no network sync:
```
createGame() → startRound() → submitAnswer() → calculateScore() → finishRound() → nextRound() → finishGame()
```
Note: "offline" = single-device party mode, not no-internet — Spotify data/previews still need to be fetched first.

---

## 14. API & Validation

```
/api/auth/{login,callback}
/api/spotify/{playlists,tracks}
/api/game/{create,join,...}
```

Every endpoint: validates input, authenticates when needed, returns typed responses, handles errors without leaking stack traces, avoids oversized payloads.

Validate **everything external** (query/route params, JSON bodies, WS messages, OAuth callbacks) — TypeScript types vanish at runtime, don't trust them alone.

```typescript
interface ApiError { code: string; message: string; }
```

---

## 15. Data & Persistence

No database just because there's a backend. Add one only for: persistent game history, user stats, persistent rooms, saved preferences, analytics. Temporary multiplayer state → realtime/state service instead. Never use Vercel's filesystem as a production store.

---

## 16. Security

**Server-only, never exposed:** Spotify client secret, refresh tokens, private API creds, DB creds, realtime service secrets.

**Client-safe (verify per provider):** Spotify client ID, public playlist/track metadata, public room state.

Never commit `.env`, `.env.local`, `credentials.json`, `tokens.json`, `secrets.json` — confirm `.gitignore` covers them.

`.env.example` should list required vars, e.g.:
```env
SPOTIFY_CLIENT_ID=
SPOTIFY_CLIENT_SECRET=
SPOTIFY_REDIRECT_URI=
```

---

## 17. Build & Quality

```bash
npm install
npm run typecheck
npm run lint
npm run build
```
Only run scripts that actually exist in `package.json`. Don't disable lint rules globally — narrow exceptions only, with a comment explaining why.

**Testing:**
- *Unit* → scoring, shuffle, question generation, validation, state transitions
- *Integration* → Spotify service, auth, game API, realtime events
- *E2E* → login → playlist select → play → answer → finish → multiplayer flow

Randomized functions should accept an injectable RNG (`shuffle(items, randomFn)`) for deterministic tests.

State transition test path: `LOBBY → STARTING → ANSWERING → ROUND_RESULT → (loop) → FINISHED`; invalid transitions must be rejected.

---

## 18. Performance

- Fetch Spotify data once, don't refetch on every render.
- Request appropriately-sized artwork (not max-res when a thumbnail will do); lazy-load long lists.
- One controlled audio instance; don't preload every track.
- Avoid heavy libraries for small utilities — prefer native APIs / existing deps.
- Short-lived caching for playlist/track/artwork metadata; never cache auth data publicly.

---

## 19. Error Recovery

```
Spotify request failed  → Retry
Preview failed          → Try another track
Connection lost         → Reconnect
Room not found          → Return to lobby
```
Never leave the user in a dead end.

---

## 20. Observability & Privacy

Log (never secrets): request ID, game ID, room ID, user ID, error code, timestamp.

Collect only what's needed for auth/gameplay/multiplayer/UX — don't retain Spotify data indefinitely without a reason. Future analytics events (if added): `game_started, game_finished, answer_submitted, playlist_selected, room_created, room_joined` — no unnecessary PII.

---

## 21. Dependency & Migration Discipline

- Upgrade deps intentionally: identify → check compatibility → update → test → build.
- Changing data structures/APIs: update types → server logic → client logic → tests → docs, in that order.
- Early dev: breaking changes are fine if documented. Once there's real user data, consider backward compatibility for sessions/state/schema/API/events.

---

## 22. Deployment Constraints (Vercel)

Don't assume: persistent filesystem, long-running processes, permanent in-memory state, a fixed server instance, or a local WebSocket server.

Avoid introducing unless clearly required: VPS, Redis, Docker cluster, message queue, Kubernetes, dedicated backend server.

---

## 23. Priorities

```
P0  Spotify auth · playlist access · track normalization · preview playback ·
    question generation · 10s timer · scoring · offline gameplay

P1  Online rooms · realtime sync · multiplayer scoring · leaderboard · reconnection

P2  Game history · statistics · advanced settings · social features
```
Don't build P2 before the P0 loop is solid.

---

## 24. Definition of Done

Implemented · type-safe · handles expected errors · has loading/empty states · no leaked secrets · fits the deployment architecture · tests pass · build succeeds · docs updated if needed.

---

## 25. Guiding Principles

**Decision checklist** (in order): Works on Vercel? Secure? Reliable? Simple? Maintainable? Performant? Minimal infra? Solves the actual problem?

**North star:** Vercel-first · TypeScript-first · security-first · gameplay-first · simple architecture · minimal dependencies · explicit state · server-authoritative multiplayer · reusable game logic.

Build a fast, reliable, maintainable music game deployable on Vercel and playable with friends — not a platform.