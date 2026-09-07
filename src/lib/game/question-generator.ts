import type { GameQuestion, GameTrack } from "./types";
import { GAME_CONSTANTS } from "./types";
import { shuffle } from "./shuffle";

export function eligibleTracks(tracks: readonly GameTrack[]): GameTrack[] {
  const ids = new Set<string>();
  return tracks.filter((track) => Boolean(track.id && track.name && track.artist && track.album && track.previewUrl) && !ids.has(track.id) && (ids.add(track.id), true));
}

export function createQuestions(tracks: readonly GameTrack[], rounds: number, random: () => number = Math.random): GameQuestion[] {
  const eligible = eligibleTracks(tracks);
  if (!Number.isInteger(rounds) || rounds < 1) throw new Error("Choose at least one round.");
  if (eligible.length < Math.max(rounds, GAME_CONSTANTS.ANSWER_CHOICES)) throw new Error(`This source only has ${eligible.length} playable tracks. Choose another source or reduce rounds.`);
  const selected = shuffle(eligible, random).slice(0, rounds);
  return selected.map((track, questionIndex) => {
    const distractors = shuffle(eligible.filter((candidate) => candidate.id !== track.id), random).slice(0, GAME_CONSTANTS.ANSWER_CHOICES - 1);
    const choices = shuffle([track, ...distractors], random).map((choice) => ({ trackId: choice.id, title: choice.name, artist: choice.artist }));
    return { id: `${track.id}-${questionIndex}`, trackId: track.id, trackName: track.name, artist: track.artist, album: track.album, artworkUrl: track.artworkUrl, previewUrl: track.previewUrl!, choices, correctTrackId: track.id };
  });
}
