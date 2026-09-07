# Product Requirements Document

## 1. Overview

A Spotify-powered music guessing game, inspired by Spotiguess's core loop but with an original implementation and identity.

Flow: a song preview plays → player has a limited time to identify it → multiple choices are shown → correct answers score points based on speed → incorrect/timeout = 0.

Supports: **Solo**, **Party (same device)**, **Online Multiplayer**.

Goal: fast, fun, polished, replayable — not a Spotiguess clone, not a feature-bloated platform.

---

## 2. Vision & Problem

Music guessing games are fun with friends, but existing options often suffer from: daily play limits, unnecessary complexity, weak multiplayer, generic UI, unclear game-state feedback.

This product should be dedicated, fast to understand, reliable in multiplayer, and visually intentional — usable without a tutorial.

---

## 3. Users

**Primary**: Spotify listeners who enjoy music trivia and want to compete with friends casually.

**Secondary**: users wanting short solo games, playlist/artist-based quizzes, casual competitive play.

---

## 4. Goals

**Primary**: reliable core loop · instantly understandable · fast answers feel rewarding · enjoyable party mode · synced online multiplayer · polished UI · lightweight & fast · works on desktop + mobile · Spotify as the sole music/metadata source.

**Secondary** (post-MVP): game history, player stats, leaderboards, replayability via varied sources.

**Non-goals** (explicitly out of scope): AI-generated recommendations/questions/artwork, social networking, messaging, voice chat, replacing Spotify playback/streaming.

---

## 5. Core Features

### 5.1 Spotify Authentication
OAuth-based login. Request only the scopes actually needed. Must **not** require Spotify Premium. Clearly communicate any Spotify-related limitations.

> **Two distinct auth needs — don't conflate them:**
> - **Authorization Code flow** (user login) → for the logged-in user's own playlists/saved tracks.
> - **Client Credentials flow** (app-level, no user login) → for browsing public playlists by URL/ID without requiring that user to own them.
>
> TECHNICAL.md/AGENTS.md must specify which flow backs which feature — don't leave this implicit.

### 5.2 Music Sources
Initial: user playlists, public playlists, user's saved tracks (where supported), artist-based sources (where supported). Architecture should allow new sources later without rewriting the quiz engine.

### 5.3 Quiz Generation
Each round = one correct song + multiple choices + audio + timer + validation + score. Correct answer always among the choices; incorrect choices drawn from the same/related source. Full spec in `GAMEPLAY.md`.

### 5.4 Solo Mode
Select source → configure → start → (listen → answer → feedback) × N rounds → results.

### 5.5 Party Mode
Same-device, multiple local players added before start (no separate accounts/devices required). UI must clearly indicate turn/first-answer status per the chosen party format.

### 5.6 Online Multiplayer
Create room → get code → share → friends join → host starts → synced rounds → independent answers → synced scores → leaderboard. Must handle normal disconnects gracefully.

### 5.7 Scoring
Max 10s/round. Faster correct = higher score; incorrect/timeout = 0. Exact formula in `GAMEPLAY.md`.

### 5.8 Results
Final score, correct/incorrect counts, accuracy, avg response time (where applicable), round-by-round breakdown, final ranking (multiplayer). Must make the winner obvious at a glance.

### 5.9 Profile
Lightweight: display name, Spotify profile info (where available), avatar, stats, recent games.

---

## 6. Key User Flows

```
First Visit:  Landing → Spotify Login → Authorize → Home
Solo:         Home → Select Source → Configure → Play Rounds → Results
Party:        Home → Party Mode → Add Players → Configure → Play Rounds → Leaderboard
Online:       Home → Create/Join Room → Lobby → Host Starts → Synced Game → Leaderboard
```

---

## 7. Functional Requirements

**Auth**: OAuth-based · session persists appropriately · tokens never unnecessarily exposed to client · expired tokens handled gracefully.

**Quiz**: exactly one correct answer per round, always present in choices · no duplicate choices · won't start without enough valid tracks · 10s max round duration.

**Scoring**: server-validated where applicable · time-based · one answer per player per round.

**Multiplayer**: unique room codes · identifiable players · synchronized state · host controls start · handles disconnects.

---

## 8. Non-Functional Requirements

- **Performance**: fast initial load, minimal JS, lazy-load non-critical assets, minimal API calls.
- **Responsive**: desktop, laptop, tablet, mobile.
- **Accessibility**: keyboard nav, visible focus, accessible controls, sufficient contrast, screen-reader labels, reduced-motion support.
- **Reliability**: graceful handling of Spotify API failures, expired auth, network failures, invalid/full rooms, disconnected players, missing audio.

---

## 9. Constraints

**Hosting**: fully deployable on Vercel — no dedicated VPS for the initial product.

**Backend/Realtime**: **Supabase** is the chosen backend — Postgres for persistence (when needed) + Supabase Realtime for multiplayer sync. This is a firm decision, not a placeholder — implementation should not re-litigate the realtime provider choice per phase. (Swap only with an explicit, documented reason.)

**Spotify — known risk**: `preview_url` on Spotify's Web API is unreliable for many apps/tracks (frequently `null`, especially for apps not in Extended Quota Mode). This directly threatens the core loop (audio preview). Mitigations:
- Filter aggressively at track-normalization time; never surface a track without a working preview.
- Validate track-pool size *after* filtering, before allowing quiz start (see §14 in GAMEPLAY.md).
- Show a clear message if a playlist has too few playable tracks post-filtering, rather than failing silently.
- Track this as an ongoing product risk — Spotify's policy here may change.

The app must not assume every Spotify API feature stays permanently available; isolate Spotify quirks from the rest of the app (see TECHNICAL.md §9).

---

## 10. Success Criteria

1. New user understands the game with zero instructions.
2. Spotify auth works reliably (both flows, §5.1).
3. A quiz starts quickly and completes without errors.
4. Scoring feels fair and predictable.
5. Party Mode works smoothly on one device.
6. Online multiplayer stays synchronized.
7. UI feels intentionally designed, not generic/AI-generated.
8. Works well on desktop and mobile.
9. Deploys cleanly through Vercel.

---

## 11. MVP Scope

**Included**: Spotify auth (both flows) · source selection · quiz generation · preview playback with preview-availability filtering · 10s timer · multiple choice · time-based scoring · Solo Mode · basic results · responsive UI.

**Deferred to later phases**: Party Mode, Online Multiplayer (see `ROADMAP.md`).