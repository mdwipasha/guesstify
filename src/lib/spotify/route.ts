import type { APIContext } from "astro";
import { SpotifyApiError } from "../../types/spotify";
import { readSession, refreshSession, serializeSession } from "./client";
import { getSessionCookieName, type SpotifySession } from "./session";

export async function requireUserSession(context: APIContext): Promise<SpotifySession> {
  const session = readSession(context.cookies.get(getSessionCookieName())?.value);
  if (!session) throw new SpotifyApiError("UNAUTHORIZED", "Log in with Spotify to use this source.");
  const refreshed = await refreshSession(session);
  if (refreshed.accessToken !== session.accessToken) context.cookies.set(getSessionCookieName(), serializeSession(refreshed), { httpOnly: true, sameSite: "lax", secure: context.url.protocol === "https:", path: "/", maxAge: 60 * 60 * 24 * 30 });
  return refreshed;
}

export function errorResponse(error: unknown): Response {
  const apiError = error instanceof SpotifyApiError ? error : new SpotifyApiError("UNKNOWN", error instanceof Error ? error.message : "The request could not be completed.");
  const status = apiError.code === "UNAUTHORIZED" ? 401 : apiError.code === "FORBIDDEN" ? 403 : apiError.code === "NOT_FOUND" ? 404 : apiError.code === "RATE_LIMITED" ? 429 : 500;
  return Response.json({ code: apiError.code, message: apiError.message }, { status });
}
