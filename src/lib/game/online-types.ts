import type { GamePhase, GameQuestion, GamePlayer, PlayerRoundResult } from "./types";

export interface OnlineRoomState {
  source: { id: string; name: string };
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  questions: GameQuestion[];
  players: GamePlayer[];
  answers: PlayerRoundResult[];
  roundStartedAt: number | null;
  results: PlayerRoundResult[] | null;
}

export interface PublicQuestion { artworkUrl: string | null; previewUrl: string; choices: GameQuestion["choices"]; }
export interface RevealedAnswer { trackId: string; title: string; artist: string; }
export interface PublicOnlinePlayer { id: string; displayName: string; avatarUrl: string | null; score: number; correctAnswers: number; connected: boolean; rank: number; accuracy: number; averageResponseTime: number | null; }
export interface PublicRoomState {
  roomId: string;
  code: string;
  hostPlayerId: string | null;
  phase: GamePhase;
  currentRound: number;
  totalRounds: number;
  roundStartedAt: number | null;
  question: PublicQuestion | null;
  revealedAnswer: RevealedAnswer | null;
  players: PublicOnlinePlayer[];
  you: { playerId: string; hasAnswered: boolean; personalResult?: PlayerRoundResult };
  results: PlayerRoundResult[] | null;
}
