import type { APIRoute } from "astro";
import { getTracks } from "../../../lib/spotify/api";
import { getClientCredentialsToken } from "../../../lib/spotify/client";
import { errorResponse, requireUserSession } from "../../../lib/spotify/route";

function validId(value: string | null): value is string { return typeof value === "string" && /^[A-Za-z0-9]{22}$/.test(value); }
export const GET: APIRoute = async (context) => {
  const source = context.url.searchParams.get("source");
  const playlistId = context.url.searchParams.get("playlistId");
  try {
    if (source === "saved") { const session = await requireUserSession(context); return Response.json(await getTracks(session.accessToken, "/me/tracks")); }
    if (!validId(playlistId)) return Response.json({ code: "INVALID_INPUT", message: "Choose a valid Spotify playlist." }, { status: 400 });
    const token = source === "public" ? await getClientCredentialsToken() : (await requireUserSession(context)).accessToken;
    return Response.json(await getTracks(token, `/playlists/${encodeURIComponent(playlistId)}/tracks`));
  } catch (error) { return errorResponse(error); }
};
