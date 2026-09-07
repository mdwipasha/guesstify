import type { GameTrack, PlaylistSummary } from "../../types/spotify";

type SpotifyImage = { url?: unknown };
type SpotifyArtist = { name?: unknown };
type SpotifyTrack = {
  id?: unknown; name?: unknown; preview_url?: unknown;
  artists?: unknown; album?: { name?: unknown; images?: unknown };
};

export function normalizeTrack(value: unknown): GameTrack | null {
  if (!value || typeof value !== "object") return null;
  const track = value as SpotifyTrack;
  const id = typeof track.id === "string" ? track.id : null;
  const name = typeof track.name === "string" ? track.name : null;
  const album = typeof track.album?.name === "string" ? track.album.name : null;
  const artist = Array.isArray(track.artists)
    ? track.artists.map((item) => typeof (item as SpotifyArtist)?.name === "string" ? (item as SpotifyArtist).name : null).filter((item): item is string => item !== null).join(", ")
    : "";
  const images = Array.isArray(track.album?.images) ? track.album.images as SpotifyImage[] : [];
  const artworkUrl = typeof images[0]?.url === "string" ? images[0].url : null;
  const previewUrl = typeof track.preview_url === "string" && track.preview_url.startsWith("https://") ? track.preview_url : null;
  return id && name && album && artist ? { id, name, artist, album, artworkUrl, previewUrl } : null;
}

export function normalizePlaylist(value: unknown): PlaylistSummary | null {
  if (!value || typeof value !== "object") return null;
  const playlist = value as { id?: unknown; name?: unknown; owner?: { display_name?: unknown }; images?: unknown; tracks?: { total?: unknown } };
  if (typeof playlist.id !== "string" || typeof playlist.name !== "string") return null;
  const images = Array.isArray(playlist.images) ? playlist.images as SpotifyImage[] : [];
  return {
    id: playlist.id,
    name: playlist.name,
    ownerName: typeof playlist.owner?.display_name === "string" ? playlist.owner.display_name : "Spotify user",
    imageUrl: typeof images[0]?.url === "string" ? images[0].url : null,
    trackCount: typeof playlist.tracks?.total === "number" ? playlist.tracks.total : 0,
  };
}
