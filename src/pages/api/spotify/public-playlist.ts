import type { APIRoute } from "astro";
import { getPlaylist } from "../../../lib/spotify/api";
import { getClientCredentialsToken } from "../../../lib/spotify/client";
import { errorResponse, readOptionalSession } from "../../../lib/spotify/route";

function playlistId(input: string | null): string | null {
  if (!input) return null;
  const match = input.match(/(?:spotify:playlist:|open\.spotify\.com\/playlist\/)?([A-Za-z0-9]{22})/);
  return match?.[1] ?? null;
}
export const GET: APIRoute = async (context) => {
  try {
    const id = playlistId(context.url.searchParams.get("id"));
    if (!id) return Response.json({ code: "INVALID_INPUT", message: "Paste a valid Spotify playlist URL or ID." }, { status: 400 });
    // Prefer user token when logged in \u2014 avoids Spotify dev-mode 403 on client credentials
    const session = await readOptionalSession(context);
    const token = session ? session.accessToken : await getClientCredentialsToken();
    return Response.json(await getPlaylist(token, id));
  } catch (error) { return errorResponse(error); }
};
