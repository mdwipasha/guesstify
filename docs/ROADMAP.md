# Product Roadmap

Four phases. Each must ship a working increment — a phase isn't "done" just because code exists; acceptance criteria must pass.

---

## Phase 1 — Core Quiz (Solo)

**Objective**: complete single-player experience — auth → source select → quiz → score → results.

**Features**
- Auth: Spotify OAuth (both Authorization Code + Client Credentials, see PRD §5.1), login/logout, session handling, basic profile.
- Sources: user playlists, public playlists (where technically available), saved tracks (where supported).
- Quiz: generation, 4 choices, 1 correct, randomization, dedup, configurable round count.
- Gameplay: audio playback, 10s timer, answer submission, correct/incorrect feedback, timeout handling, scoring.
- Results: final score, correct/incorrect, accuracy, avg response time, replay.
- UI: responsive, desktop + mobile, loading/empty/error states.

**Acceptance criteria**
- Auth works for both own and public playlists.
- Every round has valid, playable answer choices (post preview-filtering — see PRD §9 Spotify risk).
- Timer = 10s; correct → time-based score; incorrect/timeout → 0.
- Duplicate submissions blocked; quiz completes all rounds; results accurate; replay works.
- Production build succeeds; works on desktop + mobile; no critical console errors.

---

## Phase 2 — Party Mode

**Objective**: multiple people, one device.

**Features**: add/remove/rename local players · shared-device gameplay with local scoring · turn or first-answer interaction (per final game design) · round progression · local leaderboard/final ranking.

**Acceptance criteria**
- Players can be added/removed pre-start; all can participate; scores map to the right player.
- Timer and round progression work correctly through all rounds; final ranking is correct.
- Restart works. **No multiplayer server required** for this phase.
- UI works comfortably on a shared mobile/tablet/desktop device.

---

## Phase 3 — Online Multiplayer

**Objective**: separate devices, real-time synced play, via **Supabase Realtime** (decided in PRD §9 — do not re-decide here).

**Features**
- Rooms: create/join/leave, unique codes, lobby, host identification.
- Multiplayer: player list, ready state (if used), host-controlled start, synced rounds, independent answer submission, synced scores, final leaderboard.
- Realtime events: `PLAYER_JOINED`, `PLAYER_LEFT`, `GAME_STARTED`, `ROUND_STARTED`, `ANSWER_SUBMITTED`, `ROUND_FINISHED`, `SCORE_UPDATED`, `GAME_FINISHED`.
- Reliability: connection status, reconnection, host-disconnect handling, invalid/full-room handling.

**Acceptance criteria**
- Room creation/join works with unique codes; lobby updates live; host starts game.
- All players receive synced rounds with reliable timer sync.
- Answers validated and scored server-side; players cannot alter others' scores; duplicate submissions blocked.
- Disconnects don't corrupt game state; finished games can't be (re)joined; leaderboard is consistent across all clients.
- Deploys through Vercel; Supabase Realtime holds up under normal test conditions.

---

## Phase 4 — Polish & Social

**Objective**: retention, replayability, stats, and overall quality once core play is stable.

**Features**
- Profile: stats, recent games, personal bests, accuracy.
- History: past games, results, scores, performance detail.
- Leaderboard: global (where relevant), personal ranking, multiplayer stats.
- Achievements *(only if they add real replay value)*: e.g. Perfect Game, Speed Demon, Music Expert, Comeback, Playlist Master.
- UX/game polish: transitions, loading/error handling, accessibility, performance, mobile refinement, better score/round-transition/result feedback.

**Acceptance criteria**
- Profile stats and history are accurate and reliable; leaderboards don't leak invalid data.
- Achievements (if built) use deterministic, documented rules.
- No regressions in Phases 1–3; accessibility and mobile UX measurably improved; build succeeds.

---

## Explicitly Not Planned (Future Ideas)

AI-powered gameplay, AI music recommendations, voice chat, social messaging/feeds, complex UGC systems, monetization, native mobile apps. Revisit only after the core product proves itself.