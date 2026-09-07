import type { APIRoute } from "astro";
import { exchangeAuthorizationCode } from "../../../lib/spotify/client";
import { sessionCookie } from "../../../lib/spotify/session";

export const GET: APIRoute = async ({ url, cookies, redirect }) => {
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const pending = cookies.get("spotify_oauth")?.value;
  cookies.delete("spotify_oauth", { path: "/api/auth" });
  const [expectedState, verifier] = pending?.split(".") ?? [];
  if (error || !code || !state || state !== expectedState || !verifier) return redirect(`/?authError=${encodeURIComponent(error ? "Spotify authorization was cancelled." : "Spotify could not verify the login request.")}`);
  try {
    const session = await exchangeAuthorizationCode(code, verifier);
    const isSecure = url.protocol === "https:";
    return new Response(null, { status: 302, headers: { Location: "/", "Set-Cookie": sessionCookie((await import("../../../lib/spotify/client")).serializeSession(session), 60 * 60 * 24 * 30, isSecure) } });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "Spotify login failed.";
    return redirect(`/?authError=${encodeURIComponent(message)}`);
  }
};
