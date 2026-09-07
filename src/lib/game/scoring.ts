import { GAME_CONSTANTS } from "./types";
export function calculateScore(responseTimeSeconds: number, timeLimitSeconds = GAME_CONSTANTS.ROUND_DURATION_MS / 1000, maxScore = GAME_CONSTANTS.MAX_SCORE): number {
  const clamped = Math.max(0, Math.min(responseTimeSeconds, timeLimitSeconds));
  return Math.max(0, Math.min(maxScore, Math.round(maxScore * ((timeLimitSeconds - clamped) / timeLimitSeconds))));
}
