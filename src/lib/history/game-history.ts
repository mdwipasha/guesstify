import { createClient } from "@supabase/supabase-js";

export interface GameHistoryEntry {
  id: string;
  playedAt: string;
  mode: "solo" | "party" | "online";
  sourceId: string;
  sourceName: string;
  score: number;
  correctAnswers: number;
  totalRounds: number;
  accuracy: number;
  details: Record<string, unknown>;
}

function admin() {
  const url = import.meta.env.SUPABASE_URL;
  const secret = import.meta.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Game history is not configured yet. Add the Supabase server variables and apply the history migration.");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function recordGame(spotifyId: string, entry: Omit<GameHistoryEntry, "id" | "playedAt">): Promise<void> {
  const { error } = await admin().from("game_history").insert({ spotify_id: spotifyId, mode: entry.mode, source_id: entry.sourceId, source_name: entry.sourceName, score: entry.score, correct_answers: entry.correctAnswers, total_rounds: entry.totalRounds, accuracy: entry.accuracy, details: entry.details });
  if (error) throw new Error("Could not save this game to history.");
}

export async function recentGames(spotifyId: string): Promise<GameHistoryEntry[]> {
  const { data, error } = await admin().from("game_history").select("id,played_at,mode,source_id,source_name,score,correct_answers,total_rounds,accuracy,details").eq("spotify_id", spotifyId).order("played_at", { ascending: false }).limit(20);
  if (error) throw new Error("Could not load game history.");
  return (data ?? []).map((row) => { const value = row as { id: string; played_at: string; mode: GameHistoryEntry["mode"]; source_id: string; source_name: string; score: number; correct_answers: number; total_rounds: number; accuracy: number; details: Record<string, unknown> }; return { id: value.id, playedAt: value.played_at, mode: value.mode, sourceId: value.source_id, sourceName: value.source_name, score: value.score, correctAnswers: value.correct_answers, totalRounds: value.total_rounds, accuracy: value.accuracy, details: value.details }; });
}
