import type { APIRoute } from "astro";
import { recordGame, recentGames, type GameHistoryEntry } from "../../lib/history/game-history";
import { getProfile } from "../../lib/spotify/api";
import { errorResponse, requireUserSession } from "../../lib/spotify/route";

function validEntry(value: unknown): value is Omit<GameHistoryEntry, "id" | "playedAt"> {
  if (!value || typeof value !== "object") return false;
  const entry = value as Record<string, unknown>;
  return (entry.mode === "solo" || entry.mode === "party" || entry.mode === "online") && typeof entry.sourceId === "string" && entry.sourceId.length > 0 && entry.sourceId.length <= 160 && typeof entry.sourceName === "string" && entry.sourceName.length > 0 && entry.sourceName.length <= 160 && Number.isInteger(entry.score) && typeof entry.score === "number" && entry.score >= 0 && Number.isInteger(entry.correctAnswers) && typeof entry.correctAnswers === "number" && entry.correctAnswers >= 0 && Number.isInteger(entry.totalRounds) && typeof entry.totalRounds === "number" && entry.totalRounds > 0 && Number.isInteger(entry.accuracy) && typeof entry.accuracy === "number" && entry.accuracy >= 0 && entry.accuracy <= 100 && entry.details !== null && typeof entry.details === "object" && !Array.isArray(entry.details);
}
export const GET: APIRoute = async (context) => { try { const session = await requireUserSession(context); const profile = await getProfile(session.accessToken); return Response.json(await recentGames(profile.id)); } catch (error) { return errorResponse(error); } };
export const POST: APIRoute = async (context) => { try { const body: unknown = await context.request.json(); if (!validEntry(body)) return Response.json({ code: "INVALID_INPUT", message: "That completed-game record is not valid." }, { status: 400 }); const session = await requireUserSession(context); const profile = await getProfile(session.accessToken); await recordGame(profile.id, body); return new Response(null, { status: 204 }); } catch (error) { return errorResponse(error); } };
