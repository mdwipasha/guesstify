import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { createQuestions } from "../game/question-generator";
import { advanceOnlineGame, createOnlineGame, expireOnlineRound, startOnlineGame, submitOnlineAnswer } from "../game/online-engine";
import { rankPlayers } from "../game/game-engine";
import type { OnlineRoomState, PublicOnlinePlayer, PublicRoomState } from "../game/online-types";
import type { GamePlayer } from "../game/types";
import { getClientCredentialsToken } from "../spotify/client";
import { getTracks } from "../spotify/api";
import type { SpotifySession } from "../spotify/session";
import { recordGame } from "../history/game-history";

type DatabaseRoom = { id: string; code: string; host_member_id: string | null; state: OnlineRoomState; version: number; updated_at: string };
type DatabaseMember = { id: string; room_id: string; spotify_id: string; display_name: string; avatar_url: string | null; connected: boolean; last_seen_at: string };
type Source = "own" | "public" | "saved";
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const STALE_MEMBER_MS = 20_000;
const RESULT_DURATION_MS = 3_000;

function admin() {
  const url = import.meta.env.SUPABASE_URL;
  const secret = import.meta.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) throw new Error("Online Mode is not configured yet. Add the Supabase server variables and apply the migration.");
  return createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
}

function roomCode(): string { return Array.from(randomBytes(6), (byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]!).join(""); }
function asRoom(value: unknown): DatabaseRoom { return value as DatabaseRoom; }
function asMembers(value: unknown): DatabaseMember[] { return Array.isArray(value) ? value as DatabaseMember[] : []; }

export async function createRoom(input: { source: Source; playlistId?: string; sourceName?: string; rounds: number; session: SpotifySession; spotifyId: string; displayName: string; avatarUrl: string | null }): Promise<PublicRoomState> {
  const client = admin();
  // Always prefer the user session token — Spotify Dev Mode 403s Client Credentials on playlist track reads.
  // Client Credentials are only kept as an unreachable fallback path for safety.
  const token = input.session.accessToken;
  const trackPath = input.source === "saved" ? "/me/tracks" : input.playlistId ? `/playlists/${encodeURIComponent(input.playlistId)}/tracks` : null;
  if (!trackPath) throw new Error("Choose a valid playlist before creating a room.");
  const questions = createQuestions(await getTracks(token, trackPath), input.rounds);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const sourceInfo = { id: input.source === "saved" ? "liked-songs" : input.playlistId ?? "unknown-source", name: input.sourceName ?? (input.source === "saved" ? "Liked Songs" : "Spotify playlist") };
    const { data: inserted, error } = await client.from("game_rooms").insert({ code: roomCode(), state: createOnlineGame(questions, [], sourceInfo) }).select().single();
    if (error?.code === "23505") continue;
    if (error || !inserted) throw new Error("Could not create an online room.");
    const room = asRoom(inserted);
    const member = await addOrRestoreMember(client, room.id, input.spotifyId, input.displayName, input.avatarUrl);
    const state = createOnlineGame(questions, [toGamePlayer(member)], sourceInfo);
    const { error: updateError } = await client.from("game_rooms").update({ host_member_id: member.id, state, version: 1 }).eq("id", room.id).eq("version", 0);
    if (updateError) throw new Error("Could not initialize the room host.");
    return snapshot({ ...room, host_member_id: member.id, state, version: 1 }, [member], member.id);
  }
  throw new Error("Could not reserve a room code. Please try again.");
}

export async function joinRoom(code: string, identity: Identity): Promise<PublicRoomState> {
  const client = admin();
  const room = await loadRoomByCode(client, code);
  const members = await loadMembers(client, room.id);
  const existing = members.find((member) => member.spotify_id === identity.spotifyId);
  if (room.state.phase !== "LOBBY" && !existing) throw new Error("This game is already in progress. Wait for the next one.");
  const member = existing ?? await addOrRestoreMember(client, room.id, identity.spotifyId, identity.displayName, identity.avatarUrl);
  const refreshed = existing ? await touchMember(client, existing.id) : member;
  const updatedMembers = existing ? members.map((current) => current.id === refreshed.id ? refreshed : current) : [...members, member];
  if (!existing) {
    const players = [...room.state.players, toGamePlayer(member)];
    await writeRoom(client, room, { ...room.state, players }, updatedMembers, member.id);
    return snapshot({ ...room, state: { ...room.state, players }, version: room.version + 1 }, updatedMembers, member.id);
  }
  return snapshot(room, updatedMembers, refreshed.id);
}

export async function getRoom(code: string, identity: Identity): Promise<PublicRoomState> {
  const client = admin();
  let room = await loadRoomByCode(client, code);
  let members = await loadMembers(client, room.id);
  const member = members.find((current) => current.spotify_id === identity.spotifyId);
  if (!member) throw new Error("Join this room before viewing it.");
  const touched = await touchMember(client, member.id);
  members = members.map((current) => current.id === touched.id ? touched : current);
  room = await settleRoom(client, room, members);
  return snapshot(room, members, member.id);
}

export async function startRoom(code: string, identity: Identity): Promise<PublicRoomState> { return mutateRoom(code, identity, (room, _members, memberId, now) => { if (room.host_member_id !== memberId) throw new Error("Only the host can start this game."); return startOnlineGame(room.state, now); }); }
export async function submitRoomAnswer(code: string, identity: Identity, trackId: string): Promise<PublicRoomState> { return mutateRoom(code, identity, (room, members, memberId, now) => submitOnlineAnswer(room.state, memberId, trackId, now, activeMemberIds(members, now))); }
export async function leaveRoom(code: string, identity: Identity): Promise<void> {
  const client = admin(); const room = await loadRoomByCode(client, code); const members = await loadMembers(client, room.id); const member = members.find((current) => current.spotify_id === identity.spotifyId);
  if (!member) return;
  const { error } = await client.from("room_players").update({ connected: false, last_seen_at: new Date().toISOString() }).eq("id", member.id); if (error) throw new Error("Could not leave the room.");
  const updatedMembers = members.map((current) => current.id === member.id ? { ...current, connected: false } : current);
  if (room.state.phase === "LOBBY" && room.host_member_id === member.id) { const newHost = updatedMembers.find((current) => current.connected)?.id ?? null; await writeRoom(client, room, room.state, updatedMembers, newHost); }
}

export interface Identity { spotifyId: string; displayName: string; avatarUrl: string | null; }
async function mutateRoom(code: string, identity: Identity, action: (room: DatabaseRoom, members: DatabaseMember[], memberId: string, now: number) => OnlineRoomState): Promise<PublicRoomState> {
  const client = admin();
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const room = await loadRoomByCode(client, code); const members = await loadMembers(client, room.id); const member = members.find((current) => current.spotify_id === identity.spotifyId);
    if (!member) throw new Error("You are not a member of this room.");
    const now = Date.now(); const settled = await settleRoom(client, room, members, now); const state = action(settled, members, member.id, now);
    const publicState = await writeRoom(client, settled, state, members, settled.host_member_id);
    if (publicState) return snapshot({ ...settled, state, version: settled.version + 1 }, members, member.id);
  }
  throw new Error("Another player acted at the same moment. Please try again.");
}

async function settleRoom(client: ReturnType<typeof admin>, room: DatabaseRoom, members: DatabaseMember[], now = Date.now()): Promise<DatabaseRoom> {
  const activeMembers = members.map((member) => now - new Date(member.last_seen_at).getTime() > STALE_MEMBER_MS ? { ...member, connected: false } : member);
  const state = room.state.phase === "ANSWERING" ? expireOnlineRound(room.state, now, activeMemberIds(activeMembers, now)) : room.state;
  const resultStartedAt = (state as OnlineRoomState & { resultStartedAt?: number }).resultStartedAt;
  const progressed = state.phase === "ROUND_RESULT" && resultStartedAt && now - resultStartedAt >= RESULT_DURATION_MS ? advanceOnlineGame(state, now) : state;
  if (progressed !== room.state || activeMembers.some((member, index) => member.connected !== members[index]?.connected)) {
    const dated = progressed.phase === "ROUND_RESULT" && progressed !== room.state ? { ...progressed, resultStartedAt: now } : progressed;
    await writeRoom(client, room, dated, activeMembers, room.host_member_id);
    return { ...room, state: dated, version: room.version + 1 };
  }
  return room;
}

async function writeRoom(client: ReturnType<typeof admin>, room: DatabaseRoom, state: OnlineRoomState, members: DatabaseMember[], hostMemberId: string | null): Promise<boolean> {
  const { data, error } = await client.from("game_rooms").update({ state, host_member_id: hostMemberId, version: room.version + 1, updated_at: new Date().toISOString() }).eq("id", room.id).eq("version", room.version).select().maybeSingle();
  if (error) throw new Error("Could not update room state.");
  if (!data) return false;
  if (state.phase === "FINISHED" && room.state.phase !== "FINISHED") await recordOnlineHistory(state, members, room.code);
  await broadcast(room.id, snapshot({ ...room, state, host_member_id: hostMemberId, version: room.version + 1 }, members, null));
  return true;
}

async function recordOnlineHistory(state: OnlineRoomState, members: DatabaseMember[], roomCode: string): Promise<void> {
  await Promise.all(state.players.map(async (player) => { const member = members.find((current) => current.id === player.id); if (!member) return; const accuracy = Math.round((player.correctAnswers / state.totalRounds) * 100); await recordGame(member.spotify_id, { mode: "online", sourceId: state.source.id, sourceName: state.source.name, score: player.score, correctAnswers: player.correctAnswers, totalRounds: state.totalRounds, accuracy, details: { roomCode } }); }));
}

async function broadcast(roomId: string, state: PublicRoomState): Promise<void> {
  const url = import.meta.env.SUPABASE_URL; const secret = import.meta.env.SUPABASE_SECRET_KEY;
  if (!url || !secret) return;
  const response = await fetch(`${url}/realtime/v1/api/broadcast/${encodeURIComponent(`room:${roomId}`)}/events/state`, { method: "POST", headers: { apikey: secret, "Content-Type": "application/json" }, body: JSON.stringify(state) });
  if (!response.ok) console.error("Could not broadcast online room update", response.status);
}

function snapshot(room: DatabaseRoom, members: DatabaseMember[], currentMemberId: string | null): PublicRoomState {
  const currentQuestion = room.state.questions[room.state.currentRound]; const answered = currentMemberId ? room.state.answers.find((answer) => answer.playerId === currentMemberId) : undefined;
  const rankings = new Map(rankPlayers(room.state.players, room.state.totalRounds).map((player) => [player.id, player]));
  const isRevealed = room.state.phase === "ROUND_RESULT" || room.state.phase === "FINISHED";
  return { roomId: room.id, code: room.code, hostPlayerId: room.host_member_id, phase: room.state.phase, currentRound: room.state.currentRound, totalRounds: room.state.totalRounds, roundStartedAt: room.state.roundStartedAt, question: currentQuestion ? { artworkUrl: currentQuestion.artworkUrl, previewUrl: currentQuestion.previewUrl, choices: currentQuestion.choices } : null, revealedAnswer: isRevealed && currentQuestion ? { trackId: currentQuestion.correctTrackId, title: currentQuestion.trackName, artist: currentQuestion.artist } : null, players: room.state.players.map((player) => { const ranking = rankings.get(player.id)!; return toPublicPlayer(player, members.find((member) => member.id === player.id), ranking); }), you: { playerId: currentMemberId ?? "", hasAnswered: Boolean(answered), ...(answered ? { personalResult: answered } : {}) }, results: isRevealed ? room.state.results : null };
}
function toGamePlayer(member: DatabaseMember): GamePlayer { return { id: member.id, displayName: member.display_name, score: 0, correctAnswers: 0, responseTimes: [] }; }
function toPublicPlayer(player: GamePlayer, member?: DatabaseMember, ranking = { rank: 0, accuracy: 0, averageResponseTime: null as number | null }): PublicOnlinePlayer { return { id: player.id, displayName: player.displayName, avatarUrl: member?.avatar_url ?? null, score: player.score, correctAnswers: player.correctAnswers, connected: member?.connected ?? false, ...ranking }; }
function activeMemberIds(members: DatabaseMember[], now: number): Set<string> { return new Set(members.filter((member) => member.connected && now - new Date(member.last_seen_at).getTime() <= STALE_MEMBER_MS).map((member) => member.id)); }
async function loadRoomByCode(client: ReturnType<typeof admin>, code: string): Promise<DatabaseRoom> { const { data, error } = await client.from("game_rooms").select().eq("code", code.trim().toUpperCase()).maybeSingle(); if (error || !data) throw new Error("That room does not exist."); return asRoom(data); }
async function loadMembers(client: ReturnType<typeof admin>, roomId: string): Promise<DatabaseMember[]> { const { data, error } = await client.from("room_players").select().eq("room_id", roomId).order("joined_at"); if (error) throw new Error("Could not load room players."); return asMembers(data); }
async function addOrRestoreMember(client: ReturnType<typeof admin>, roomId: string, spotifyId: string, displayName: string, avatarUrl: string | null): Promise<DatabaseMember> { const { data, error } = await client.from("room_players").upsert({ room_id: roomId, spotify_id: spotifyId, display_name: displayName, avatar_url: avatarUrl, connected: true, last_seen_at: new Date().toISOString() }, { onConflict: "room_id,spotify_id" }).select().single(); if (error || !data) throw new Error("Could not add you to this room."); return data as DatabaseMember; }
async function touchMember(client: ReturnType<typeof admin>, memberId: string): Promise<DatabaseMember> { const { data, error } = await client.from("room_players").update({ connected: true, last_seen_at: new Date().toISOString() }).eq("id", memberId).select().single(); if (error || !data) throw new Error("Could not restore your room connection."); return data as DatabaseMember; }
