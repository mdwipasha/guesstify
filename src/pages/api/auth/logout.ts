import type { APIRoute } from "astro";
import { getSessionCookieName } from "../../../lib/spotify/session";
export const POST: APIRoute = ({ cookies }) => { cookies.delete(getSessionCookieName(), { path: "/" }); return new Response(null, { status: 204 }); };
