import { describe, expect, it } from "vitest";
import { createQuestions } from "./question-generator";
import { createOnlineGame, expireOnlineRound, startOnlineGame, submitOnlineAnswer } from "./online-engine";
import type { GameTrack } from "./types";

const tracks: GameTrack[] = Array.from({ length: 5 }, (_, index) => ({ id: `id-${index}`, name: `Track ${index}`, artist: "Artist", album: "Album", artworkUrl: null, previewUrl: `https://audio/${index}` }));
const players = [{ id: "a", displayName: "Ari", score: 0, correctAnswers: 0, responseTimes: [] }, { id: "b", displayName: "Bea", score: 0, correctAnswers: 0, responseTimes: [] }];
describe("online game authority", () => {
  it("scores independently and completes when all active players answer", () => { const started = startOnlineGame(createOnlineGame(createQuestions(tracks, 1), players), 0); const first = submitOnlineAnswer(started, "a", started.questions[0]!.correctTrackId, 2500, new Set(["a", "b"])); const wrongChoice = started.questions[0]!.choices.find((choice) => choice.trackId !== started.questions[0]!.correctTrackId)!; const final = submitOnlineAnswer(first, "b", wrongChoice.trackId, 5000, new Set(["a", "b"])); expect(first.phase).toBe("ANSWERING"); expect(final.phase).toBe("ROUND_RESULT"); expect(final.players[0]!.score).toBe(750); expect(final.players[1]!.score).toBe(0); });
  it("rejects duplicate, late, and malformed answers", () => { const started = startOnlineGame(createOnlineGame(createQuestions(tracks, 1), players), 0); const answered = submitOnlineAnswer(started, "a", started.questions[0]!.correctTrackId, 1000, new Set(["a", "b"])); expect(() => submitOnlineAnswer(answered, "a", answered.questions[0]!.correctTrackId, 1200, new Set(["a", "b"]))).toThrow("already answered"); expect(() => submitOnlineAnswer(started, "b", "fake", 1000, new Set(["a", "b"]))).toThrow("not valid"); expect(() => submitOnlineAnswer(started, "b", started.questions[0]!.correctTrackId, 10_000, new Set(["a", "b"]))).toThrow("no longer"); });
  it("expires without waiting for disconnected players", () => { const started = startOnlineGame(createOnlineGame(createQuestions(tracks, 1), players), 0); const result = expireOnlineRound(started, 10_000, new Set(["a"])); expect(result.phase).toBe("ROUND_RESULT"); expect(result.results).toHaveLength(1); expect(result.results?.[0]?.playerId).toBe("a"); });
});
