import { describe, expect, it } from "vitest";
import { calculateScore } from "./scoring";
import { createQuestions } from "./question-generator";
import { createPartyGame, createSoloGame, nextPartyRound, nextRound, rankPlayers, startPartyTurn, startRound, submitAnswer, submitPartyAnswer } from "./game-engine";
import type { GameTrack } from "./types";

const tracks: GameTrack[] = Array.from({ length: 5 }, (_, index) => ({ id: `id-${index}`, name: `Track ${index}`, artist: "Artist", album: "Album", artworkUrl: null, previewUrl: `https://audio/${index}` }));
describe("scoring", () => { it("matches documented boundaries", () => { expect(calculateScore(0)).toBe(1000); expect(calculateScore(1)).toBe(900); expect(calculateScore(5)).toBe(500); expect(calculateScore(9)).toBe(100); expect(calculateScore(10)).toBe(0); expect(calculateScore(-2)).toBe(1000); }); });
describe("question generation", () => { it("dedupes tracks and creates four unique choices", () => { const questions = createQuestions([...tracks, tracks[0]!], 2, () => 0.4); expect(questions).toHaveLength(2); for (const question of questions) { expect(question.choices).toHaveLength(4); expect(new Set(question.choices.map((choice) => choice.trackId)).size).toBe(4); expect(question.choices.some((choice) => choice.trackId === question.correctTrackId)).toBe(true); } }); it("rejects an insufficient playable pool", () => { expect(() => createQuestions(tracks.slice(0, 3), 3)).toThrow("only has 3 playable tracks"); }); });
describe("solo game transitions", () => { it("locks a submitted answer and finishes after the final result", () => { const game = createSoloGame(createQuestions(tracks, 1)); const active = startRound(game, 0); const result = submitAnswer(active, active.questions[0]!.correctTrackId, 2500); expect(result.score).toBe(750); expect(() => submitAnswer(result, "id-2", 3000)).toThrow("not accepting"); expect(nextRound(result).phase).toBe("FINISHED"); }); });
describe("party game transitions", () => {
  it("assigns every turn to its player, hides results until the round ends, and advances", () => {
    const questions = createQuestions(tracks, 2, () => 0.4);
    const firstTurn = startPartyTurn(createPartyGame(questions, ["Ari", "Bea"]), 0);
    const handoff = submitPartyAnswer(firstTurn, firstTurn.questions[0]!.correctTrackId, 2500);
    expect(handoff.phase).toBe("STARTING"); expect(handoff.result).toBeNull(); expect(handoff.players[0]!.score).toBe(750); expect(handoff.players[1]!.score).toBe(0);
    const reveal = submitPartyAnswer(startPartyTurn(handoff, 3000), "wrong", 3500);
    expect(reveal.phase).toBe("ROUND_RESULT"); expect(reveal.result?.playerResults).toHaveLength(2); expect(reveal.result?.playerResults[0]?.playerId).toBe("player-1"); expect(reveal.result?.playerResults[1]?.playerId).toBe("player-2");
    expect(nextPartyRound(reveal).currentRound).toBe(1);
  });
  it("ranks by score, correct answers, then average response time with shared ranks", () => {
    const ranked = rankPlayers([{ id: "a", displayName: "Ari", score: 500, correctAnswers: 1, responseTimes: [5] }, { id: "b", displayName: "Bea", score: 500, correctAnswers: 1, responseTimes: [4] }, { id: "c", displayName: "Cy", score: 500, correctAnswers: 1, responseTimes: [4] }], 2);
    expect(ranked.map((player) => [player.displayName, player.rank])).toEqual([["Bea", 1], ["Cy", 1], ["Ari", 3]]);
  });
});
