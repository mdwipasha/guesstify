import type { APIRoute } from "astro";
import { createRoom } from "../../../../lib/multiplayer/rooms";
import { getProfile } from "../../../../lib/spotify/api";
import { errorResponse, requireUserSession } from "../../../../lib/spotify/route";

export const POST: APIRoute = async (context) => {
  try {
    const body: unknown = await context.request.json();
    if (!body || typeof body !== "object") return Response.json({ code: "INVALID_INPUT", message: "Send room settings as JSON." }, { status: 400 });
    const value = body as { source?: unknown; playlistId?: unknown; sourceName?: unknown; rounds?: unknown };
    if ((value.source !== "own" && value.source !== "public" && value.source !== "saved") || !Number.isInteger(value.rounds) || typeof value.rounds !== "number" || value.rounds < 1 || value.rounds > 20 || (value.source !== "saved" && (typeof value.playlistId !== "string" || !/^[A-Za-z0-9]{22}$/.test(value.playlistId)))) return Response.json({ code: "INVALID_INPUT", message: "Choose a valid music source and round count." }, { status: 400 });
    const session = await requireUserSession(context); const profile = await getProfile(session.accessToken);
    if (value.sourceName !== undefined && (typeof value.sourceName !== "string" || value.sourceName.length < 1 || value.sourceName.length > 160)) return Response.json({ code: "INVALID_INPUT", message: "Choose a valid music source name." }, { status: 400 });
    return Response.json(await createRoom({ source: value.source, playlistId: value.playlistId as string | undefined, sourceName: value.sourceName as string | undefined, rounds: value.rounds, session, spotifyId: profile.id, displayName: profile.displayName, avatarUrl: profile.imageUrl }), { status: 201 });
  } catch (error) {
    // Plain Error instances (e.g. createQuestions "too few playable tracks") are user-input problems — 400.
    // SpotifyApiError subclasses carry structured codes — let errorResponse map them to the right HTTP status.
    if (error instanceof Error && error.constructor === Error) return Response.json({ code: "INVALID_INPUT", message: error.message }, { status: 400 });
    return errorResponse(error);
  }
};
