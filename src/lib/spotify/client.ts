import { SpotifyApiError } from "../../types/spotify";
import { decodeSession, encodeSession, type SpotifySession } from "./session";

const SPOTIFY_API = "https://api.spotify.com/v1";
const SPOTIFY_ACCOUNTS = "https://accounts.spotify.com/api/token";
let appToken: { token: string; expiresAt: number } | null = null;

function credentials(): { clientId: string; clientSecret: string } {
  const clientId = import.meta.env.SPOTIFY_CLIENT_ID;
  const clientSecret = import.meta.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new SpotifyApiError("UNKNOWN", "Spotify is not configured on this deployment.");
  return { clientId, clientSecret };
}

function errorForStatus(status: number): SpotifyApiError {
  if (status === 400) return new SpotifyApiError("UNKNOWN", "Spotify rejected the request. The session may be invalid — try logging out and back in.");
  if (status === 401) return new SpotifyApiError("UNAUTHORIZED", "Your Spotify session has expired. Please log in again.");
  if (status === 403) return new SpotifyApiError("FORBIDDEN", "Spotify blocked access to this content. It may be private, restricted, or unavailable in the current app mode. Try a different source or log in with Spotify.");
  if (status === 404) return new SpotifyApiError("NOT_FOUND", "Spotify could not find that playlist.");
  if (status === 429) return new SpotifyApiError("RATE_LIMITED", "Spotify is busy. Please wait a moment and try again.");
  if (status >= 500) return new SpotifyApiError("UNKNOWN", "Spotify is temporarily unavailable. Please try again in a moment.");
  return new SpotifyApiError("UNKNOWN", "Spotify could not complete that request.");
}

async function tokenRequest(body: URLSearchParams): Promise<SpotifySession> {
  const { clientId, clientSecret } = credentials();
  let response: Response;
  try {
    response = await fetch(SPOTIFY_ACCOUNTS, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body,
    });
  } catch { throw new SpotifyApiError("NETWORK", "Could not reach Spotify. Check your connection and try again."); }
  if (!response.ok) throw errorForStatus(response.status);
  const payload: unknown = await response.json();
  if (!payload || typeof payload !== "object") throw new SpotifyApiError("UNKNOWN", "Spotify sent an invalid authentication response.");
  const data = payload as { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown };
  if (typeof data.access_token !== "string" || typeof data.expires_in !== "number") throw new SpotifyApiError("UNKNOWN", "Spotify did not provide an access token.");
  return { accessToken: data.access_token, refreshToken: typeof data.refresh_token === "string" ? data.refresh_token : "", expiresAt: Date.now() + data.expires_in * 1000 };
}

export async function exchangeAuthorizationCode(code: string, verifier: string): Promise<SpotifySession> {
  const session = await tokenRequest(new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: import.meta.env.SPOTIFY_REDIRECT_URI ?? "", code_verifier: verifier }));
  if (!session.refreshToken) throw new SpotifyApiError("UNKNOWN", "Spotify did not provide a refresh token.");
  return session;
}

export async function refreshSession(session: SpotifySession): Promise<SpotifySession> {
  if (session.expiresAt > Date.now() + 30_000) return session;
  if (!session.refreshToken) throw new SpotifyApiError("UNAUTHORIZED", "Your Spotify session has expired. Please log in again.");
  const refreshed = await tokenRequest(new URLSearchParams({ grant_type: "refresh_token", refresh_token: session.refreshToken }));
  return { ...refreshed, refreshToken: refreshed.refreshToken || session.refreshToken };
}

export async function getClientCredentialsToken(): Promise<string> {
  if (appToken && appToken.expiresAt > Date.now() + 30_000) return appToken.token;
  const session = await tokenRequest(new URLSearchParams({ grant_type: "client_credentials" }));
  appToken = { token: session.accessToken, expiresAt: session.expiresAt };
  return session.accessToken;
}

export async function spotifyFetch(path: string, accessToken: string): Promise<unknown> {
  let response: Response;
  try { response = await fetch(`${SPOTIFY_API}${path}`, { headers: { Authorization: `Bearer ${accessToken}` } }); }
  catch { throw new SpotifyApiError("NETWORK", "Could not reach Spotify. Check your connection and try again."); }
  if (!response.ok) {
    // Log the full Spotify error for server-side debugging.
    const body = await response.text().catch(() => "(unreadable body)");
    console.error(`[spotify] ${response.status} on ${path} — ${body}`);
    throw errorForStatus(response.status);
  }
  return response.json();
}

export function readSession(cookie: string | undefined): SpotifySession | null { return decodeSession(cookie); }
export function serializeSession(session: SpotifySession): string { return encodeSession(session); }
