import type { GameTrack } from "../../types/spotify";
export type { GameTrack };

export const GAME_CONSTANTS = { ROUND_DURATION_MS: 10_000, MAX_SCORE: 1_000, ANSWER_CHOICES: 4 } as const;

export interface GameChoice { trackId: string; title: string; artist: string; }
export interface GameQuestion {
  id: string; trackId: string; trackName: string; artist: string; album: string;
  artworkUrl: string | null; previewUrl: string; choices: GameChoice[]; correctTrackId: string;
}
export interface RoundResult { selectedTrackId: string | null; correctTrackId: string; isCorrect: boolean; score: number; responseTime: number | null; }
export type GamePhase = "LOBBY" | "STARTING" | "ANSWERING" | "ROUND_RESULT" | "FINISHED";
export interface SoloGameState { phase: GamePhase; currentRound: number; totalRounds: number; score: number; correctAnswers: number; responseTimes: number[]; questions: GameQuestion[]; roundStartedAt: number | null; result: RoundResult | null; }

export interface GamePlayer {
  id: string;
  displayName: string;
  score: number;
  correctAnswers: number;
  responseTimes: number[];
}

export interface PlayerRoundResult extends RoundResult { playerId: string; }
export interface PartyRoundResult { correctTrackId: string; playerResults: PlayerRoundResult[]; }
export interface PartyGameState {
  mode: "offline";
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  questions: GameQuestion[];
  players: GamePlayer[];
  currentPlayerIndex: number;
  roundStartedAt: number | null;
  turnResults: PlayerRoundResult[];
  result: PartyRoundResult | null;
}

export interface LeaderboardEntry extends GamePlayer { rank: number; accuracy: number; averageResponseTime: number | null; }
