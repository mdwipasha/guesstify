import type { APIRoute } from "astro";
import { getUserPlaylists } from "../../../lib/spotify/api";
import { errorResponse, requireUserSession } from "../../../lib/spotify/route";
export const GET: APIRoute = async (context) => { try { const session = await requireUserSession(context); return Response.json(await getUserPlaylists(session.accessToken)); } catch (error) { return errorResponse(error); } };
