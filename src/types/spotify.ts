export interface GameTrack {
  id: string;
  name: string;
  artist: string;
  album: string;
  artworkUrl: string | null;
  previewUrl: string | null;
}

export interface PlaylistSummary {
  id: string;
  name: string;
  ownerName: string;
  imageUrl: string | null;
  trackCount: number;
}

export interface SpotifyProfile {
  id: string;
  displayName: string;
  imageUrl: string | null;
}

export type SpotifyErrorCode = "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "RATE_LIMITED" | "NETWORK" | "UNKNOWN";

export class SpotifyApiError extends Error {
  constructor(public readonly code: SpotifyErrorCode, message: string) {
    super(message);
  }
}
