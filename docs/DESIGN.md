# Design System & Visual Direction

## 1. Direction

Should feel like a **real music game** — music, speed, competition, personality, confidence, fun. Modern and polished without leaning on visual trends. Something people actually want to open with friends, not a technical demo.

---

## 2. Principles

1. **Clarity first** — user always knows: what's happening, what to do, time remaining, their score, what's next. Never sacrifice usability for novelty.
2. **Game first** — gameplay screen priority order: Audio → Timer → Answer choices → Current score → Progress. Everything else is secondary.
3. **Strong hierarchy** — one clear primary action per screen (e.g. quiz screen: primary = answer; secondary = score/progress; tertiary = nav/controls).
4. **Intentionality** — every element has a purpose. No decorative shapes, filler icons, fake stats, or motion without meaning. Whitespace is fine.
5. **Personality without noise** — energetic, confident, playful, modern, competitive. Never childish, chaotic, overly futuristic, corporate, or generic.
6. **Speed** — instant feedback on interaction, fast transitions, no delay added purely to feel "fancy."

---

## 3. Anti-AI-Slop Rules

Avoid: excessive gradients/glassmorphism, glowing purple/blue interfaces, decorative blobs, arbitrary floating cards, oversized rounded containers, excessive pill controls/drop shadows, decorative gradient text, generic dashboard layouts, meaningless/excessive icons, stock illustrations, random 3D objects, neon effects, visual noise, repeated identical card layouts.

**Core rule**: a visual effect only earns its place if it improves hierarchy, feedback, branding, usability, or atmosphere. If removing it makes things clearer — remove it.

---

## 4. Visual Identity

Built around music, speed, competition, social interaction. Must feel like its own music game — **not** a Spotify clone; don't reproduce Spotify's UI. Visual language should work across Solo, Party, and Online modes equally.

---

## 5. Color System

Define: primary, secondary accent, background, surface, elevated surface, primary/secondary/muted text, border, success, error, warning — all semantic.

- **Success** → correct answers, positive feedback, successful actions. Noticeable, not overwhelming.
- **Error** → incorrect answers, failed actions. Must stay readable; never rely on color alone.
- **Warning** → time running out, connection issues. Urgent without being aggressive.
- **Discipline**: don't use every accent color at once — the product needs one dominant identity; reserve semantic colors for semantic states.

---

## 6. Typography

Max **2 font families** unless there's a strong reason for more.

| Role | Use |
|---|---|
| Display | game titles, large scores, major result states |
| Heading | page/section titles |
| Body | descriptions, supporting content |
| Label | metadata, secondary info |
| Numeric | scores/timers/rankings — optimized for quick scanning |

Build hierarchy through size, weight, spacing, and position — not excessive styling.

---

## 7–8. Spacing & Layout

Use a consistent spacing scale (small = related elements, medium = content groups, large = major sections) — don't invent arbitrary values per component or leave purposeless empty space.

Consistent grid: predictable max widths, consistent padding/vertical rhythm. Gameplay screens may break standard width when it improves usability. Avoid `Card > Card > Card > Content` nesting — not everything needs a card.

---

## 9–10. Components & Buttons

Core set: Button, Icon Button, Input, Select, Dialog, Toast, Avatar, Track Card, Playlist Card, Answer Option, Timer, Score Display, Player Row, Leaderboard Row, Game Status, Progress Indicator. Each interactive component defines: default, hover, active, focus, disabled, loading, and (where relevant) error states.

**Button hierarchy**:
- Primary → Start Game, Create Room, Join Room, Play Again
- Secondary → Browse Playlist, View History
- Tertiary → Cancel, Back, Close

Don't make every button visually dominant.

---

## 11. Navigation

Keep it simple — not an enterprise dashboard. Primary nav exposes only: Play, Sources/Library, History, Profile. Current destination always obvious. During active gameplay, nav should recede or disappear — player shouldn't accidentally leave a game.

---

## 12–13. Home & Setup

**Home hierarchy**: User Identity → Primary Play Action → Game Modes → Music Sources → Recent Activity. It's a "play" screen, not a dashboard.

**Quiz setup**: fast, progressive disclosure — `Choose Source → Choose Mode → Choose Rounds → Start`. Advanced settings hidden behind an optional toggle; shouldn't feel like enterprise config.

---

## 14–18. Quiz Interface (most important screen)

Priority: Timer → Audio state → Question context → Answer choices → Score → Round progress.

- **Desktop**: extra width for artwork/score/players/progress, but answer choices stay primary.
- **Mobile**: large tap targets, clear timer, thumb-friendly, minimal nav/secondary info — not just a shrunk desktop layout.
- **Timer**: immediately visible, strong hierarchy, subtle urgency as it counts down; final seconds may use stronger feedback; must never obstruct the answer choices.
- **Answer choices**: large, scannable, visually distinct, keyboard-accessible; selection state obvious; no confirmation dialogs. Correct → clear success (e.g. `✓ Night Changes +742`). Incorrect → clear failure with correct answer revealed (`✕ ... Correct answer: Night Changes +0`) — never color-only.
- **Score feedback**: immediate, prominent (`CORRECT +742 0.74s`). Avoid confetti/screen-shake/flashing overload — motion should reinforce the result, not distract.
- **Progress**: `ROUND 4/10` or dot indicators — secondary to the question itself.

---

## 19–22. Multiplayer Screens

**Lobby**: room code (easy to copy — `[ Copy Code ]`), host, current/max players, ready state, start state. Avoid a "corporate meeting app" feel.

**Multiplayer gameplay**: players always know who's playing, current round/score/state, and who's leading — but don't clutter the answering moment with constant player info.

**Player identity**: avatar/initials + name + score — identifiable within a fraction of a second, nothing more complex.

**Leaderboard**: clear rank hierarchy, current user's position easy to spot, winner gets clear (not excessive) emphasis.

---

## 23–24. Results & Music Source UI

**Results** must answer instantly: who won? what was my score? what's next? Primary actions: Play Again / New Game / Home. Secondary stats (accuracy, correct count, avg response time, best round) shouldn't overwhelm the headline result.

**Source browsing**: artwork, playlist/track name, creator, track count. Don't turn every playlist into a giant card — artwork should carry a clear visual role.

---

## 25–29. Loading, Empty, Error, Toasts, Dialogs

- **Loading**: always say what's happening (`Loading playlists...`, `Joining room...`) — never a blank screen. Skip skeletons if the wait is too short to matter.
- **Empty**: explain what's empty, why, and what to do next (`No playable playlists found. Try another playlist or reconnect Spotify. [Browse Playlists]`).
- **Error**: specific and actionable — never just "Something went wrong" when the app knows what happened (`We couldn't load this playlist. Spotify didn't return the tracks. [Try Again]`).
- **Toasts**: short-lived, low-stakes feedback only (room code copied, settings saved) — not for anything requiring attention.
- **Dialogs**: reserved for genuine interruptions (confirm leaving a game, confirm logout, destructive actions) — not routine navigation.

---

## 30. Responsive

Mobile-first for interaction, then expand:
- **Mobile**: thumb-friendly controls, large answer buttons, minimal nav/distractions.
- **Tablet**: room for larger artwork, better answer layout, player info.
- **Desktop**: player info, scoreboard, supporting context, larger artwork, balanced layout.

Never just stretch the mobile layout onto desktop.

---

## 31–33. Accessibility, Motion, Audio Feedback

- Keyboard nav, visible focus, semantic HTML, accessible labels, sufficient contrast, reduced-motion support, screen-reader support. **Color is never the sole indicator** of correctness/selection/status.
- Motion should communicate state change/feedback/progress/hierarchy — short, predictable, purposeful, respecting `prefers-reduced-motion`. Gameplay feedback can use stronger motion than nav, but must never interfere with answering.
- Optional sound effects (correct/incorrect/countdown/start/finish) — never required to understand the UI; users can play silently. Keep separate from actual music playback.

---

## 34–38. Interaction, Density, Cards, Icons, Forms

- Every interaction gets clear feedback (hover/press/active; select/validate/result; join/loading/joined) — user should never wonder if an action registered.
- Target **focused density**: enough info to be useful, only what's needed for the current task — avoid both clutter and artificial sparseness.
- Use cards selectively (grouping, hierarchy, highlighting) — not `Card / Card / Card / Card` as a default layout.
- Icons must be consistent, recognizable, functional — not decoration for empty space; pair with labels when meaning could be ambiguous.
- Forms: short, focused, clearly labeled, validated close to the input, actionable error messages, no unnecessary fields.

---

## 39. Design Tokens

Define reusable tokens for colors, typography, spacing, radius, shadows, transitions, breakpoints. Components consume tokens — never hardcode arbitrary values.

---

## 40–41. Quality Bar & Final Rule

A screen isn't done just because it works, is responsive, and uses tokens — it also needs clear hierarchy, consistent spacing, strong typography, intentional composition, real interaction feedback, and proper loading/empty/error states. It should feel like a **finished consumer product**, not a generated prototype.

When in doubt:
```
Better usability      > more visual effects
Clearer hierarchy     > more features on screen
Fits the product      > trendy pattern
```

The interface should look **designed**, not generated.