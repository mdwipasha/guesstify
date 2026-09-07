import { calculateScore } from "./scoring";
import type { GameQuestion, GamePlayer, PlayerRoundResult } from "./types";
import type { OnlineRoomState } from "./online-types";

export function createOnlineGame(questions: GameQuestion[], players: GamePlayer[], source = { id: "unknown-source", name: "Spotify source" }): OnlineRoomState {
  return { source, phase: "LOBBY", currentRound: 0, totalRounds: questions.length, questions, players, answers: [], roundStartedAt: null, results: null };
}

export function startOnlineGame(state: OnlineRoomState, now: number): OnlineRoomState {
  if (state.phase !== "LOBBY") throw new Error("This game has already started.");
  return { ...state, phase: "ANSWERING", roundStartedAt: now, answers: [], results: null };
}

export function submitOnlineAnswer(state: OnlineRoomState, playerId: string, selectedTrackId: string, now: number, activePlayerIds: ReadonlySet<string>): OnlineRoomState {
  if (state.phase !== "ANSWERING" || state.roundStartedAt === null || now - state.roundStartedAt >= 10_000) throw new Error("This round is no longer accepting answers.");
  if (!activePlayerIds.has(playerId)) throw new Error("Disconnected players cannot submit answers.");
  if (state.answers.some((answer) => answer.playerId === playerId)) throw new Error("You already answered this round.");
  const question = state.questions[state.currentRound];
  if (!question || !question.choices.some((choice) => choice.trackId === selectedTrackId)) throw new Error("That answer is not valid for this round.");
  const responseTime = Math.max(0, (now - state.roundStartedAt) / 1000);
  const isCorrect = selectedTrackId === question.correctTrackId;
  const score = isCorrect ? calculateScore(responseTime) : 0;
  const answer: PlayerRoundResult = { playerId, selectedTrackId, correctTrackId: question.correctTrackId, isCorrect, score, responseTime };
  return applyAnswer({ ...state, answers: [...state.answers, answer] }, answer, activePlayerIds);
}

export function expireOnlineRound(state: OnlineRoomState, now: number, activePlayerIds: ReadonlySet<string>): OnlineRoomState {
  if (state.phase !== "ANSWERING" || state.roundStartedAt === null || now - state.roundStartedAt < 10_000) return state;
  const question = state.questions[state.currentRound]!;
  const missed = [...activePlayerIds].filter((playerId) => !state.answers.some((answer) => answer.playerId === playerId)).map((playerId): PlayerRoundResult => ({ playerId, selectedTrackId: null, correctTrackId: question.correctTrackId, isCorrect: false, score: 0, responseTime: null }));
  return finishRound({ ...state, answers: [...state.answers, ...missed] });
}

export function advanceOnlineGame(state: OnlineRoomState, now: number): OnlineRoomState {
  if (state.phase !== "ROUND_RESULT") throw new Error("The current round has not finished.");
  if (state.currentRound + 1 >= state.totalRounds) return { ...state, phase: "FINISHED", roundStartedAt: null };
  return { ...state, phase: "ANSWERING", currentRound: state.currentRound + 1, roundStartedAt: now, answers: [], results: null };
}

function applyAnswer(state: OnlineRoomState, answer: PlayerRoundResult, activePlayerIds: ReadonlySet<string>): OnlineRoomState {
  const players = state.players.map((player) => player.id === answer.playerId ? { ...player, score: player.score + answer.score, correctAnswers: player.correctAnswers + Number(answer.isCorrect), responseTimes: answer.responseTime === null ? player.responseTimes : [...player.responseTimes, answer.responseTime] } : player);
  const updated = { ...state, players };
  return [...activePlayerIds].every((playerId) => updated.answers.some((current) => current.playerId === playerId)) ? finishRound(updated) : updated;
}

function finishRound(state: OnlineRoomState): OnlineRoomState { return { ...state, phase: "ROUND_RESULT", roundStartedAt: null, results: state.answers }; }
