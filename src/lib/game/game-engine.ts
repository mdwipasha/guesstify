import { calculateScore } from "./scoring";
import type { GamePlayer, GameQuestion, LeaderboardEntry, PartyGameState, PlayerRoundResult, RoundResult, SoloGameState } from "./types";

export function createSoloGame(questions: GameQuestion[]): SoloGameState {
  return { phase: "LOBBY", currentRound: 0, totalRounds: questions.length, score: 0, correctAnswers: 0, responseTimes: [], questions, roundStartedAt: null, result: null };
}
export function startRound(state: SoloGameState, now: number): SoloGameState {
  if (state.phase !== "LOBBY" && state.phase !== "ROUND_RESULT") throw new Error("The current game phase cannot start a round.");
  return { ...state, phase: "ANSWERING", roundStartedAt: now, result: null };
}
export function submitAnswer(state: SoloGameState, selectedTrackId: string | null, now: number): SoloGameState {
  if (state.phase !== "ANSWERING" || state.roundStartedAt === null) throw new Error("This round is not accepting answers.");
  const question = state.questions[state.currentRound];
  if (!question) throw new Error("There is no active question.");
  const responseTime = Math.max(0, (now - state.roundStartedAt) / 1000);
  const isCorrect = selectedTrackId === question.correctTrackId && responseTime < 10;
  const score = isCorrect ? calculateScore(responseTime) : 0;
  const result: RoundResult = { selectedTrackId, correctTrackId: question.correctTrackId, isCorrect, score, responseTime: selectedTrackId === null ? null : responseTime };
  return { ...state, phase: "ROUND_RESULT", result, score: state.score + score, correctAnswers: state.correctAnswers + Number(isCorrect), responseTimes: selectedTrackId === null ? state.responseTimes : [...state.responseTimes, responseTime] };
}
export function nextRound(state: SoloGameState): SoloGameState {
  if (state.phase !== "ROUND_RESULT") throw new Error("Finish the current round before continuing.");
  if (state.currentRound + 1 >= state.totalRounds) return { ...state, phase: "FINISHED", roundStartedAt: null };
  return { ...state, phase: "LOBBY", currentRound: state.currentRound + 1, roundStartedAt: null };
}

export function createPartyGame(questions: GameQuestion[], playerNames: readonly string[]): PartyGameState {
  const normalizedNames = playerNames.map((name) => name.trim()).filter(Boolean);
  if (normalizedNames.length < 2) throw new Error("Add at least two players for a party game.");
  if (new Set(normalizedNames.map((name) => name.toLocaleLowerCase())).size !== normalizedNames.length) throw new Error("Each player needs a different name.");
  const players: GamePlayer[] = normalizedNames.map((displayName, index) => ({ id: `player-${index + 1}`, displayName, score: 0, correctAnswers: 0, responseTimes: [] }));
  return { mode: "offline", phase: "STARTING", currentRound: 0, totalRounds: questions.length, questions, players, currentPlayerIndex: 0, roundStartedAt: null, turnResults: [], result: null };
}

export function startPartyTurn(state: PartyGameState, now: number): PartyGameState {
  if (state.phase !== "STARTING") throw new Error("The next player cannot start yet.");
  return { ...state, phase: "ANSWERING", roundStartedAt: now };
}

export function submitPartyAnswer(state: PartyGameState, selectedTrackId: string | null, now: number): PartyGameState {
  if (state.phase !== "ANSWERING" || state.roundStartedAt === null) throw new Error("This turn is not accepting answers.");
  const question = state.questions[state.currentRound];
  const player = state.players[state.currentPlayerIndex];
  if (!question || !player) throw new Error("The party game has no active question or player.");
  const responseTime = Math.max(0, (now - state.roundStartedAt) / 1000);
  const isCorrect = selectedTrackId === question.correctTrackId && responseTime < 10;
  const score = isCorrect ? calculateScore(responseTime) : 0;
  const playerResult: PlayerRoundResult = { playerId: player.id, selectedTrackId, correctTrackId: question.correctTrackId, isCorrect, score, responseTime: selectedTrackId === null ? null : responseTime };
  const players = state.players.map((candidate) => candidate.id === player.id ? { ...candidate, score: candidate.score + score, correctAnswers: candidate.correctAnswers + Number(isCorrect), responseTimes: selectedTrackId === null ? candidate.responseTimes : [...candidate.responseTimes, responseTime] } : candidate);
  const turnResults = [...state.turnResults, playerResult];
  if (turnResults.length === state.players.length) return { ...state, players, turnResults, phase: "ROUND_RESULT", roundStartedAt: null, result: { correctTrackId: question.correctTrackId, playerResults: turnResults } };
  return { ...state, players, turnResults, currentPlayerIndex: state.currentPlayerIndex + 1, phase: "STARTING", roundStartedAt: null };
}

export function nextPartyRound(state: PartyGameState): PartyGameState {
  if (state.phase !== "ROUND_RESULT") throw new Error("Reveal this round before continuing.");
  if (state.currentRound + 1 >= state.totalRounds) return { ...state, phase: "FINISHED", roundStartedAt: null };
  return { ...state, phase: "STARTING", currentRound: state.currentRound + 1, currentPlayerIndex: 0, turnResults: [], result: null, roundStartedAt: null };
}

export function rankPlayers(players: readonly GamePlayer[], totalRounds: number): LeaderboardEntry[] {
  const sorted = [...players].sort((left, right) => right.score - left.score || right.correctAnswers - left.correctAnswers || averageResponseTime(left) - averageResponseTime(right) || left.displayName.localeCompare(right.displayName));
  let previous: GamePlayer | null = null;
  let rank = 0;
  return sorted.map((player, index) => {
    if (!previous || !isTied(player, previous)) rank = index + 1;
    previous = player;
    return { ...player, rank, accuracy: Math.round((player.correctAnswers / totalRounds) * 100), averageResponseTime: player.responseTimes.length ? averageResponseTime(player) : null };
  });
}

function averageResponseTime(player: GamePlayer): number { return player.responseTimes.length ? player.responseTimes.reduce((total, time) => total + time, 0) / player.responseTimes.length : Number.POSITIVE_INFINITY; }
function isTied(left: GamePlayer, right: GamePlayer): boolean { return left.score === right.score && left.correctAnswers === right.correctAnswers && averageResponseTime(left) === averageResponseTime(right); }
