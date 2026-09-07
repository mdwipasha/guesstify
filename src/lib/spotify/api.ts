import type { GameTrack, PlaylistSummary, SpotifyProfile } from "../../types/spotify";
import { normalizePlaylist, normalizeTrack } from "./normalize";
import { spotifyFetch } from "./client";

type Page = { items?: unknown[]; next?: string | null };

function pageItems(value: unknown): { items: unknown[]; hasNext: boolean } {
  const page = value as Page;
  return { items: Array.isArray(page?.items) ? page.items : [], hasNext: typeof page?.next === "string" };
}

export async function getProfile(accessToken: string): Promise<SpotifyProfile> {
  const value = await spotifyFetch("/me", accessToken) as { id?: unknown; display_name?: unknown; images?: Array<{ url?: unknown }> };
  if (typeof value.id !== "string") throw new Error("Spotify returned an invalid profile.");
  return { id: value.id, displayName: typeof value.display_name === "string" ? value.display_name : "Spotify listener", imageUrl: typeof value.images?.[0]?.url === "string" ? value.images[0].url : null };
}

export async function getUserPlaylists(accessToken: string): Promise<PlaylistSummary[]> {
  const playlists: PlaylistSummary[] = [];
  for (let offset = 0; offset < 250; offset += 50) {
    const page = pageItems(await spotifyFetch(`/me/playlists?limit=50&offset=${offset}`, accessToken));
    playlists.push(...page.items.map(normalizePlaylist).filter((item): item is PlaylistSummary => item !== null));
    if (!page.hasNext) break;
  }
  return playlists;
}

export async function getPlaylist(accessToken: string, playlistId: string): Promise<PlaylistSummary> {
  const value = normalizePlaylist(await spotifyFetch(`/playlists/${encodeURIComponent(playlistId)}?fields=id,name,owner(display_name),images,tracks(total)`, accessToken));
  if (!value) throw new Error("Spotify returned an invalid playlist.");
  return value;
}

export async function getTracks(accessToken: string, path: string): Promise<GameTrack[]> {
  const tracks: GameTrack[] = [];
  for (let offset = 0; offset < 500; offset += 100) {
    const page = pageItems(await spotifyFetch(`${path}${path.includes("?") ? "&" : "?"}limit=100&offset=${offset}`, accessToken));
    for (const item of page.items) {
      const source = item && typeof item === "object" && "track" in item ? (item as { track?: unknown }).track : item;
      const normalized = normalizeTrack(source);
      if (normalized) tracks.push(normalized);
    }
    if (!page.hasNext) break;
  }
  return tracks;
}
