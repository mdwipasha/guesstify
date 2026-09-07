import type { APIRoute } from "astro";
import { createHash, randomBytes } from "node:crypto";

export const GET: APIRoute = async ({ cookies, redirect }) => {
  const clientId = import.meta.env.SPOTIFY_CLIENT_ID;
  const redirectUri = import.meta.env.SPOTIFY_REDIRECT_URI;
  if (!clientId || !redirectUri) return new Response("Spotify authentication is not configured.", { status: 500 });
  const verifier = randomBytes(64).toString("base64url");
  const state = randomBytes(24).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  cookies.set("spotify_oauth", `${state}.${verifier}`, { httpOnly: true, sameSite: "lax", secure: new URL(redirectUri).protocol === "https:", path: "/api/auth", maxAge: 600 });
  const params = new URLSearchParams({ response_type: "code", client_id: clientId, redirect_uri: redirectUri, state, code_challenge_method: "S256", code_challenge: challenge, scope: "playlist-read-private playlist-read-collaborative user-library-read user-read-private" });
  return redirect(`https://accounts.spotify.com/authorize?${params}`);
};
