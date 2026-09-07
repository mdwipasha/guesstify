import type { APIRoute } from "astro";
import { getPlaylist } from "../../../lib/spotify/api";
import { getClientCredentialsToken } from "../../../lib/spotify/client";
import { errorResponse } from "../../../lib/spotify/route";

function playlistId(input: string | null): string | null {
  if (!input) return null;
  const match = input.match(/(?:spotify:playlist:|open\.spotify\.com\/playlist\/)?([A-Za-z0-9]{22})/);
  return match?.[1] ?? null;
}
export const GET: APIRoute = async ({ url }) => { try { const id = playlistId(url.searchParams.get("id")); if (!id) return Response.json({ code: "INVALID_INPUT", message: "Paste a valid Spotify playlist URL or ID." }, { status: 400 }); return Response.json(await getPlaylist(await getClientCredentialsToken(), id)); } catch (error) { return errorResponse(error); } };
