# Gameplay Specification

## 1. Core Loop

```
Choose Source → Generate Quiz → Play Preview → 10s Timer →
Player Answers → Calculate Score → Show Result → Next Round → Final Results
```

> **Hear the song. Guess the song. Answer faster. Score higher.**

---

## 2. Game Modes

### 2.1 Online Multiplayer
Each player on their own device, joined via room code. **Server is authoritative** for song, choices, round, timer, and phase — players just submit answers independently. Realtime transport: Supabase Realtime (see PRD §9, TECHNICAL.md §12).

### 2.2 Offline / Party Mode
All players share one device, no server required — runs entirely in-browser. Same core rules apply: 10s timer, multiple choice, scoring, round progression, final leaderboard. Reuses the same game engine as online mode (see §32).

---

## 3. Configuration

**Minimum**: music source, number of rounds, mode. **Optional**: difficulty, duplicate-track behavior, sound effects, preview duration. Keep the default path fast — don't expose everything up front.

---

## 4–6. Music Source & Track Eligibility

Spotify is the sole source (auth, playlists, metadata, artwork, previews) — no Premium required.

A track is quiz-eligible only when it has: **Track ID, Name, Artist, Album, Artwork, and a working Preview Audio URL.**

> ⚠️ **Known risk**: Spotify's `preview_url` is frequently `null` for many apps/tracks. Never create a question from a track without a *verified* working preview. See PRD §9 for mitigation (aggressive filtering + pool-size validation before quiz start).

Public playlists (not owned by the logged-in user) must be reachable via Client Credentials auth — see PRD §5.1.

---

## 7. Quiz Generation Pipeline

```
Fetch Tracks → Remove Invalid (no usable preview) → Dedupe (by Track ID)
  → Shuffle → Select N → Generate Questions (4 choices, 1 correct, 3 distractors)
```

Prepare the full question pool **before** gameplay starts — avoids inter-round delays and keeps online players in sync.

---

## 8–9. Question & Answer Structure

```json
{
  "trackId": "5O2P9iiztwhomNh8xkR9lJ",
  "trackName": "Night Changes",
  "artist": "One Direction",
  "album": "FOUR (Deluxe)",
  "choices": ["Ready To Run", "Night Changes", "Girl Almighty", "Steal My Girl"],
  "correctAnswer": "Night Changes"
}
```

4 choices, exactly 1 correct. **Client never receives `correctTrackId` before the player answers or the round ends** — server retains it internally (see TECHNICAL.md §8).

---

## 10–11. Distractors & Randomization

Prefer distractors from the same playlist/artist/era/popularity tier over random unrelated tracks — makes the quiz meaningfully harder and more fun. Randomize the correct answer's position **independently for every question** — never fixed.

---

## 12–13. Round Lifecycle

```
ROUND START → Prepare Question → Play Preview → 10s Timer →
Player Answers → Lock Answer → Calculate Score → Show Result → Transition → Next Round
```

---

## 14–16. Timer & Answer Locking

10-second window starting when the question becomes active; synchronized against the authoritative game state in online play (timestamp-based — see TECHNICAL.md §11, not a ticking server value).

```
0.0s–9.9s → time-based score on correct answer
timer = 0 with no answer → score = 0, round ends
```

Once submitted, an answer is **locked** — no changes. Prevents double submission, score manipulation, and race conditions.

---

## 17. Correctness

Always validate by **Track ID**, never by title string (titles aren't guaranteed unique):
```
selectedTrackId === correctTrackId   ✅
selectedAnswer === "Night Changes"   ❌
```

---

## 18–20. Scoring

```
MAX_SCORE = 1000
TIME_LIMIT = 10s
score = round(MAX_SCORE * (TIME_LIMIT - responseTime) / TIME_LIMIT)
score = clamp(score, 0, MAX_SCORE)
```

| Response Time | Score |
|---|---|
| 0.0s | 1000 |
| 2.5s | 750 |
| 5.0s | 500 |
| 7.5s | 250 |
| 10.0s | 0 |

Incorrect answer → **0**, regardless of speed. No answer (timeout) → **0**.

---

## 21–24. Online Authority & Sync

Server determines `responseTime`, correctness, and score from the authoritative submission timestamp — **never trust client-reported values**.

Client sends intent only: `{ answerId, submittedAt }`. Server computes the rest.

```typescript
type GamePhase = "LOBBY" | "STARTING" | "ANSWERING" | "ROUND_RESULT" | "FINISHED";
```

Server owns: room state, round/question, game start, round start, timer reference, answer validation, scores, round/game completion.
Client owns: rendering, preview playback, timer *display*, sending answers, showing server-provided results.

---

## 25–30. Room, Join, Disconnects & Answer Submission

- **Join**: validate room → create player → broadcast player list → player appears in lobby, receiving current state immediately.
- **Disconnect**: mark disconnected → update room → notify remaining players. Tolerate brief network blips; don't block the game indefinitely on one player.
- **Host disconnect** (pre-game): auto-select new host. **Host disconnect** (mid-game): server keeps running the game — never depend on the host's browser for scoring.
- **Answer submission**: one per player per round; round ends when the timer expires *or* all active players have answered. Don't wait forever on a disconnected player.
- **Result visibility**: after answering, a player sees their answer, the correct answer, points earned, and running total — but nothing that could bias players who haven't answered yet.

---

## 31. Anti-Cheat

Never trust the client for: final score, correct answer, remaining time, round number, game completion, or ranking. Client is presentation + input only.

---

## 32–33. Offline Mode

Runs fully client-side, reusing the **same scoring/validation/game-engine logic** as online mode (no server sync needed). Shared-device flow: question appears → everyone listens → each player picks their answer → submit → result → next round. UI should make it obvious this is a shared-device session.

---

## 34–36. Completion, Tie-Breaking & Reset

Final ranking: sort by total score (deterministic). Ties broken in order: **1) total score → 2) correct-answer count → 3) avg response time.** Still equal → shared rank.

Post-game actions: Play Again (reuse room/settings), New Game (new config), Home.

---

## 37–40. Audio Handling

- Preview should autoplay when the question activates; if the browser blocks autoplay, require one user interaction (e.g. "Start Game" click) to unlock audio for the whole session.
- Broken/failed preview → retry once → if still broken, **skip/replace the question** (all online players transition together, consistently).
- If a selected track becomes unavailable before playback, swap it for a replacement following the same generation rules — never change the correct answer *after* it's been shown.

---

## 41–43. Duplicates, Insufficient Tracks & Difficulty

- Uniqueness is by **Track ID** — dedupe duplicate playlist entries before generating questions.
- Validate the eligible-track count *before* starting: a 10-round game needs 10 unique playable tracks. If short, show a clear message (e.g. "This playlist only has 7 playable tracks — choose another or reduce rounds") rather than silently repeating tracks.
- Difficulty comes from track/distractor selection (well-known vs. obscure, same-artist vs. mixed distractors) — never from altering the scoring formula.

---

## 44–46. UI ↔ State Binding

UI must always reflect the authoritative phase — never show controls invalid for the current state:

| Phase | Answer control |
|---|---|
| LOBBY | unavailable |
| ANSWERING (before submit) | available |
| ANSWERING (after submit) | locked |
| ROUND_RESULT / FINISHED | unavailable |

---

## 47–49. Reconnection, Late Join & Leaving

- **Reconnect**: authenticate → restore room membership → **request current authoritative state** (never reconstruct locally) → resume.
- **Late join**: disabled by default once a game is active — keeps sync simple and fair. A late player waits for the next game.
- **Leaving mid-game**: requires confirmation ("Your current progress will be lost"); remaining online players are notified.

---

## 50. Data Model (conceptual)

```
Game     → id, mode, host, players, settings, currentRound, totalRounds, phase, questions
Player   → id, displayName, avatar, score, correctAnswers, answered, responseTimes
Question → id, trackId, trackName, artist, album, artwork, preview, choices, correctTrackId
```

---

## 51. Invariants (must always hold)

1. Exactly one correct answer per question, exactly four choices.
2. One answer submission per player per round; none accepted after timer expiry.
3. Incorrect/no-answer = 0 points; faster correct = more points.
4. No track repeats within a game unless explicitly enabled.
5. Online scores are always server-calculated — client never determines the final score.
6. All online players get the identical question and choices.
7. Correct answer is never revealed before the round ends.
8. A disconnected player never blocks the game indefinitely.
9. Game won't start without enough playable tracks; a broken preview never permanently blocks play.

---

## 52. Worked Example

```
ROUND 3/10 — "Night Changes"
Player selects C (correct) at 2.4s
score = round(1000 × (10 - 2.4) / 10) = 760
Total: 1,420 + 760 = 2,180 → Next Round
```

Multiplayer round (4 players):
```
Pasha  → correct @1.2s → 880
Dimas  → correct @4.1s → 590
Rizky  → incorrect      → 0
Capa   → no answer      → 0
```

---

## 53. Philosophy

Minimize waiting, configuration, dialogs, long animations, and confusing states. The player should never feel like they're navigating an application — just: **listen, guess, answer, score, next.**