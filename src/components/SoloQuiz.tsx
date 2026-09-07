import { useCallback, useEffect, useRef, useState } from "react";
import { createQuestions } from "../lib/game/question-generator";
import { OnlineQuiz } from "./OnlineQuiz";
import { createPartyGame, createSoloGame, nextPartyRound, nextRound, rankPlayers, startPartyTurn, startRound, submitAnswer, submitPartyAnswer } from "../lib/game/game-engine";
import { GAME_CONSTANTS, type PartyGameState, type SoloGameState } from "../lib/game/types";
import type { GameTrack, PlaylistSummary, SpotifyProfile } from "../types/spotify";

type Status = "checking" | "guest" | "ready";
type ApiError = { message?: string };
const roundsOptions = [5, 10, 15];
type MusicSource = { type: "own" | "public" | "saved"; playlist?: PlaylistSummary };

async function request<T>(url: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) { const body = await response.json().catch((): ApiError => ({})); throw new Error(body.message ?? "We couldn't complete that request."); }
  return response.json() as Promise<T>;
}

function playlistId(value: string): string | null {
  return value.match(/(?:spotify:playlist:|open\.spotify\.com\/playlist\/)?([A-Za-z0-9]{22})/)?.[1] ?? null;
}

function formatTime(milliseconds: number): string { return (Math.max(0, milliseconds) / 1000).toFixed(1); }
function sourceInfo(source: MusicSource): { id: string; name: string } { return source.type === "saved" ? { id: "liked-songs", name: "Liked Songs" } : { id: source.playlist?.id ?? "unknown-source", name: source.playlist?.name ?? "Spotify playlist" }; }

export function SoloQuiz() {
  const [status, setStatus] = useState<Status>("checking");
  const [profile, setProfile] = useState<SpotifyProfile | null>(null);
  const [playlists, setPlaylists] = useState<PlaylistSummary[] | null>(null);
  const [source, setSource] = useState<MusicSource | null>(null);
  const [publicValue, setPublicValue] = useState("");
  const [rounds, setRounds] = useState(10);
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(() => new URLSearchParams(window.location.search).get("authError"));
  const [game, setGame] = useState<SoloGameState | null>(null);
  const [partySetup, setPartySetup] = useState(false);
  const [onlineSetup, setOnlineSetup] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [partyPlayers, setPartyPlayers] = useState<string[]>(["", ""]);
  const [partyGame, setPartyGame] = useState<PartyGameState | null>(null);
  const [historySource, setHistorySource] = useState<{ id: string; name: string } | null>(null);
  const [partyHistorySource, setPartyHistorySource] = useState<{ id: string; name: string } | null>(null);
  const [historyMessage, setHistoryMessage] = useState<string | null>(null);
  const [partyNow, setPartyNow] = useState(0);
  const [now, setNow] = useState(0);
  const [audioMessage, setAudioMessage] = useState<string | null>(null);
  const audio = useRef<HTMLAudioElement | null>(null);
  const retryCount = useRef(0);
  const recordedGames = useRef(new WeakSet<object>());
  const persistHistory = useCallback(async (entry: { mode: "solo" | "party"; sourceId: string; sourceName: string; score: number; correctAnswers: number; totalRounds: number; accuracy: number; details: Record<string, unknown> }) => { if (!profile) { setHistoryMessage("Log in to save this game."); return; } try { const response = await fetch("/api/history", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(entry) }); if (!response.ok) throw new Error(); setHistoryMessage("Saved to your Recent Games."); } catch { setHistoryMessage("This game finished, but we couldn’t save it to history."); } }, [profile]);

  useEffect(() => { void request<SpotifyProfile>("/api/spotify/profile").then((value) => { setProfile(value); setStatus("ready"); }).catch(() => setStatus("guest")); }, []);
  useEffect(() => {
    if (game?.phase !== "ANSWERING") return;
    const timer = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      setGame((state) => state?.phase === "ANSWERING" && state.roundStartedAt !== null && currentTime - state.roundStartedAt >= GAME_CONSTANTS.ROUND_DURATION_MS ? submitAnswer(state, null, currentTime) : state);
    }, 50);
    return () => window.clearInterval(timer);
  }, [game?.phase]);
  const activeQuestion = game?.phase === "ANSWERING" ? game.questions[game.currentRound] : null;
  useEffect(() => {
    if (!activeQuestion || !audio.current) return;
    retryCount.current = 0; setAudioMessage(null); audio.current.src = activeQuestion.previewUrl;
    void audio.current.play().catch(() => setAudioMessage("Tap Play preview if your browser blocked audio."));
  }, [activeQuestion]);
  useEffect(() => {
    if (partyGame?.phase !== "ANSWERING") return;
    const timer = window.setInterval(() => {
      const currentTime = Date.now();
      setPartyNow(currentTime);
      setPartyGame((state) => state?.phase === "ANSWERING" && state.roundStartedAt !== null && currentTime - state.roundStartedAt >= GAME_CONSTANTS.ROUND_DURATION_MS ? submitPartyAnswer(state, null, currentTime) : state);
    }, 50);
    return () => window.clearInterval(timer);
  }, [partyGame?.phase]);
  const partyQuestion = partyGame ? partyGame.questions[partyGame.currentRound] : null;
  useEffect(() => {
    if (!partyGame || partyGame.phase !== "STARTING" || partyGame.currentPlayerIndex !== 0 || !partyQuestion || !audio.current) return;
    retryCount.current = 0; setAudioMessage(null); audio.current.src = partyQuestion.previewUrl;
    void audio.current.play().catch(() => setAudioMessage("Tap Play preview if your browser blocked audio."));
  }, [partyGame, partyQuestion]);
  useEffect(() => { if (game?.phase === "FINISHED" && historySource && !recordedGames.current.has(game)) { recordedGames.current.add(game); void persistHistory({ mode: "solo", sourceId: historySource.id, sourceName: historySource.name, score: game.score, correctAnswers: game.correctAnswers, totalRounds: game.totalRounds, accuracy: Math.round((game.correctAnswers / game.totalRounds) * 100), details: {} }); } }, [game, historySource, persistHistory]);
  useEffect(() => { if (partyGame?.phase === "FINISHED" && partyHistorySource && !recordedGames.current.has(partyGame)) { recordedGames.current.add(partyGame); const ranked = rankPlayers(partyGame.players, partyGame.totalRounds); const winner = ranked[0]!; void persistHistory({ mode: "party", sourceId: partyHistorySource.id, sourceName: partyHistorySource.name, score: winner.score, correctAnswers: winner.correctAnswers, totalRounds: partyGame.totalRounds, accuracy: winner.accuracy, details: { players: ranked.map((player) => ({ name: player.displayName, score: player.score, correctAnswers: player.correctAnswers, accuracy: player.accuracy })) } }); } }, [partyGame, partyHistorySource, persistHistory]);

  async function loadPlaylists() {
    setLoading("playlists"); setError(null);
    try { setPlaylists(await request<PlaylistSummary[]>("/api/spotify/playlists")); }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load your playlists."); }
    finally { setLoading(null); }
  }
  async function selectPublic() {
    setError(null); const id = playlistId(publicValue);
    if (!id) { setError("Paste a valid Spotify playlist URL or ID."); return; }
    setLoading("public");
    try {
      const playlist = await request<PlaylistSummary>(`/api/spotify/public-playlist?id=${encodeURIComponent(id)}`);
      if (playlist.trackCount === 0) {
        setError(`"${playlist.name}" has no tracks. Choose a different playlist.`);
        return;
      }
      setSource({ type: "public", playlist });
    }
    catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load that public playlist."); }
    finally { setLoading(null); }
  }
  async function startGame() {
    if (!source) return;
    setLoading("quiz"); setError(null);
    try {
      const url = source.type === "saved" ? "/api/spotify/tracks?source=saved" : `/api/spotify/tracks?source=${source.type}&playlistId=${source.playlist!.id}`;
      const tracks = await request<GameTrack[]>(url);
      const questions = createQuestions(tracks, rounds);
      setHistorySource(sourceInfo(source));
      const started = startRound(createSoloGame(questions), Date.now());
      setGame(started); setNow(Date.now());
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not prepare this quiz."); }
    finally { setLoading(null); }
  }
  async function startPartyGame() {
    if (!source) return;
    setLoading("party"); setError(null);
    try {
      const url = source.type === "saved" ? "/api/spotify/tracks?source=saved" : `/api/spotify/tracks?source=${source.type}&playlistId=${source.playlist!.id}`;
      const tracks = await request<GameTrack[]>(url);
      setPartyHistorySource(sourceInfo(source));
      setPartyGame(createPartyGame(createQuestions(tracks, rounds), partyPlayers)); setPartyNow(Date.now());
    } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not prepare this party game."); }
    finally { setLoading(null); }
  }
  function answer(trackId: string | null) { setGame((state) => state?.phase === "ANSWERING" ? submitAnswer(state, trackId, Date.now()) : state); }
  function continueGame() { setGame((state) => state ? nextRound(state) : state); }
  function startNextPartyTurn() { setPartyGame((state) => state?.phase === "STARTING" ? startPartyTurn(state, Date.now()) : state); setPartyNow(Date.now()); }
  function answerParty(trackId: string | null) { setPartyGame((state) => state?.phase === "ANSWERING" ? submitPartyAnswer(state, trackId, Date.now()) : state); }
  function continueParty() { setPartyGame((state) => state?.phase === "ROUND_RESULT" ? nextPartyRound(state) : state); }
  async function logout() { await fetch("/api/auth/logout", { method: "POST" }); setProfile(null); setStatus("guest"); setPlaylists(null); setSource(null); }
  const remaining = game?.phase === "ANSWERING" && game.roundStartedAt ? GAME_CONSTANTS.ROUND_DURATION_MS - (now - game.roundStartedAt) : GAME_CONSTANTS.ROUND_DURATION_MS;

  if (status === "checking") return <main className="screen center"><p className="eyebrow">GUESSTIFY</p><h1>Loading your play space…</h1></main>;
  if (onlineSetup) return <OnlineQuiz onBack={() => setOnlineSetup(false)} />;
  if (historyOpen) return <RecentGames onBack={() => setHistoryOpen(false)} />;
  if (partyGame?.phase === "FINISHED") return <PartyResults game={partyGame} historyMessage={historyMessage} onReplay={() => setPartyGame(createPartyGame(partyGame.questions, partyGame.players.map((player) => player.displayName)))} onNewGame={() => setPartyGame(null)} />;
  if (partyGame) return <PartyGameScreen game={partyGame} remaining={partyGame.phase === "ANSWERING" && partyGame.roundStartedAt ? GAME_CONSTANTS.ROUND_DURATION_MS - (partyNow - partyGame.roundStartedAt) : GAME_CONSTANTS.ROUND_DURATION_MS} audio={audio} audioMessage={audioMessage} onStartTurn={startNextPartyTurn} onAnswer={answerParty} onContinue={continueParty} onRetryAudio={() => { if (audio.current) void audio.current.play(); }} onAudioError={() => setAudioMessage("This preview could not play. You can still finish the round.")} />;
  if (game?.phase === "FINISHED") return <Results game={game} historyMessage={historyMessage} onReplay={() => { const reset = startRound(createSoloGame(game.questions), Date.now()); setGame(reset); }} onNewGame={() => setGame(null)} />;
  if (game) return <GameScreen game={game} remaining={remaining} audio={audio} audioMessage={audioMessage} onAnswer={answer} onContinue={continueGame} onRetryAudio={() => { if (audio.current) void audio.current.play(); }} onAudioError={() => { if (audio.current && retryCount.current === 0) { retryCount.current += 1; audio.current.load(); void audio.current.play().catch(() => setAudioMessage("This preview could not play. You can still finish the round.")); } else setAudioMessage("This preview could not play. You can still finish the round."); }} />;
  if (partySetup) return <main className="screen"><header className="topbar"><a className="brand" href="/">GUESSTIFY</a><button className="text-button" onClick={() => setPartySetup(false)}>Back to solo</button></header><section className="setup"><p className="eyebrow">PARTY MODE</p><h1>Pass it around. Keep score.</h1><p className="lead">Everyone hears the preview together, then takes a private ten-second turn on the same device.</p>{error && <div className="notice error" role="alert">{error}</div>}<PlayerEditor players={partyPlayers} onChange={setPartyPlayers} /><SourcePicker status={status} playlists={playlists} source={source} publicValue={publicValue} loading={loading} onLoadPlaylists={() => void loadPlaylists()} onSelect={(value) => setSource(value)} onPublicValue={setPublicValue} onSelectPublic={() => void selectPublic()} /><div className="setup-footer"><label>Rounds<select value={rounds} onChange={(event) => setRounds(Number(event.target.value))}>{roundsOptions.map((value) => <option key={value} value={value}>{value} rounds</option>)}</select></label><button className="button primary" disabled={!source || loading !== null || partyPlayers.filter((name) => name.trim()).length < 2} onClick={() => void startPartyGame()}>{loading === "party" ? "Preparing playable tracks…" : "Start party game"}</button></div></section></main>;
  return <main className="screen"><header className="topbar"><a className="brand" href="/">GUESSTIFY</a>{profile ? <div className="profile"><span>{profile.displayName}</span><button className="text-button" onClick={() => setHistoryOpen(true)}>Recent games</button><button className="text-button" onClick={() => void logout()}>Log out</button></div> : <a className="button secondary" href="/api/auth/login">Log in with Spotify</a>}</header><section className="setup"><p className="eyebrow">SOLO MODE</p><h1>Pick music. Trust your ears.</h1><p className="lead">Every round plays a short Spotify preview. Answer before the ten seconds disappear.</p>{error && <div className="notice error" role="alert">{error}</div>}<SourcePicker status={status} playlists={playlists} source={source} publicValue={publicValue} loading={loading} onLoadPlaylists={() => void loadPlaylists()} onSelect={(value) => setSource(value)} onPublicValue={setPublicValue} onSelectPublic={() => void selectPublic()} /><div className="setup-footer"><label>Rounds<select value={rounds} onChange={(event) => setRounds(Number(event.target.value))}>{roundsOptions.map((value) => <option key={value} value={value}>{value} rounds</option>)}</select><button className="text-button party-link" onClick={() => setPartySetup(true)}>Play with friends instead</button><button className="text-button party-link" onClick={() => setOnlineSetup(true)}>Play online</button></label><button className="button primary" disabled={!source || loading !== null} onClick={() => void startGame()}>{loading === "quiz" ? "Preparing playable tracks…" : "Start solo game"}</button></div></section></main>;
}

function SourcePicker({ status, playlists, source, publicValue, loading, onLoadPlaylists, onSelect, onPublicValue, onSelectPublic }: { status: Status; playlists: PlaylistSummary[] | null; source: MusicSource | null; publicValue: string; loading: string | null; onLoadPlaylists: () => void; onSelect: (source: MusicSource) => void; onPublicValue: (value: string) => void; onSelectPublic: () => void }) {
  return <section className="sources" aria-label="Music source"><h2>Choose your music</h2>{status === "ready" ? <><div className="source-actions"><button className="button secondary" onClick={onLoadPlaylists} disabled={loading !== null}>{loading === "playlists" ? "Loading playlists…" : "Your playlists"}</button><button className={`button secondary ${source?.type === "saved" ? "selected" : ""}`} onClick={() => onSelect({ type: "saved" })}>Liked songs</button></div>{playlists && (playlists.length ? <div className="playlist-grid">{playlists.map((playlist) => <button className={`playlist ${source?.playlist?.id === playlist.id ? "selected" : ""}`} key={playlist.id} onClick={() => onSelect({ type: "own", playlist })}>{playlist.imageUrl ? <img src={playlist.imageUrl} alt="" /> : <span className="artwork-fallback">♫</span>}<span><strong>{playlist.name}</strong><small>{playlist.ownerName} · {playlist.trackCount} tracks</small></span></button>)}</div> : <div className="notice">No playlists were returned by Spotify. Try your Liked Songs or a public playlist.</div>)}</> : <div className="notice">Log in to use your playlists or Liked Songs. You can still play a public playlist below.</div>}<div className="public-source"><label htmlFor="public-playlist">Public Spotify playlist</label><div><input id="public-playlist" value={publicValue} onChange={(event) => onPublicValue(event.target.value)} placeholder="Paste playlist URL or ID" /><button className="button secondary" onClick={onSelectPublic} disabled={loading !== null}>{loading === "public" ? "Checking…" : "Use playlist"}</button></div>{source?.type === "public" && source.playlist && <p className="selected-source">Selected: {source.playlist.name} · {source.playlist.trackCount} tracks</p>}</div></section>;
}

function GameScreen({ game, remaining, audio, audioMessage, onAnswer, onContinue, onRetryAudio, onAudioError }: { game: SoloGameState; remaining: number; audio: React.RefObject<HTMLAudioElement | null>; audioMessage: string | null; onAnswer: (id: string | null) => void; onContinue: () => void; onRetryAudio: () => void; onAudioError: () => void }) {
  const question = game.questions[game.currentRound]!; const result = game.result;
  return <main className="game-screen"><audio ref={audio} onError={onAudioError} preload="metadata" /><header className="game-header"><a className="brand" href="/">GUESSTIFY</a><span>ROUND {game.currentRound + 1}/{game.totalRounds}</span><strong>{game.score.toLocaleString()} pts</strong></header>{game.phase === "ANSWERING" ? <section className="question"><div className={`timer ${remaining <= 3_000 ? "urgent" : ""}`} aria-live="polite">{formatTime(remaining)}<small>seconds</small></div><p className="eyebrow">NAME THAT TRACK</p><h1>Listen closely, then choose.</h1><button className="audio-control" onClick={onRetryAudio}>▶ Play preview</button>{audioMessage && <p className="audio-message">{audioMessage}</p>}<div className="answers">{question.choices.map((choice, index) => <button key={choice.trackId} className="answer" onClick={() => onAnswer(choice.trackId)}><span>{String.fromCharCode(65 + index)}</span><strong>{choice.title}</strong><small>{choice.artist}</small></button>)}</div></section> : <section className={`round-result ${result?.isCorrect ? "correct" : "wrong"}`}><p className="eyebrow">{result?.isCorrect ? "CORRECT" : result?.selectedTrackId ? "NOT QUITE" : "TIME'S UP"}</p><h1>{result?.isCorrect ? `+${result.score} points` : "+0 points"}</h1><p>{result?.isCorrect ? `${result.responseTime?.toFixed(2)} seconds` : `The answer was ${question.trackName} — ${question.artist}`}</p><button className="button primary" onClick={onContinue}>{game.currentRound + 1 === game.totalRounds ? "See results" : "Next round"}</button></section>}</main>;
}

function Results({ game, historyMessage, onReplay, onNewGame }: { game: SoloGameState; historyMessage: string | null; onReplay: () => void; onNewGame: () => void }) { const answered = game.responseTimes.length; const accuracy = game.totalRounds ? Math.round((game.correctAnswers / game.totalRounds) * 100) : 0; const average = answered ? (game.responseTimes.reduce((total, value) => total + value, 0) / answered).toFixed(2) : "—"; return <main className="screen results"><p className="eyebrow">GAME COMPLETE</p><h1>{game.score.toLocaleString()}</h1><p className="lead">points scored</p><div className="stat-grid"><div><strong>{game.correctAnswers}/{game.totalRounds}</strong><span>correct</span></div><div><strong>{accuracy}%</strong><span>accuracy</span></div><div><strong>{average}</strong><span>avg response</span></div></div>{historyMessage && <p className="history-message">{historyMessage}</p>}<div className="result-actions"><button className="button primary" onClick={onReplay}>Play again</button><button className="button secondary" onClick={onNewGame}>New music</button></div></main>; }

function PlayerEditor({ players, onChange }: { players: string[]; onChange: (players: string[]) => void }) {
  function update(index: number, value: string) { onChange(players.map((player, playerIndex) => playerIndex === index ? value : player)); }
  function remove(index: number) { onChange(players.filter((_, playerIndex) => playerIndex !== index)); }
  return <section className="players-editor" aria-labelledby="party-players"><div><h2 id="party-players">Who’s playing?</h2><p>Names appear on every turn and the final leaderboard.</p></div><div className="player-fields">{players.map((player, index) => <div className="player-field" key={`${index}-${player}`}><span className="player-avatar">{player.trim().charAt(0).toUpperCase() || index + 1}</span><label><span className="sr-only">Player {index + 1} name</span><input value={player} onChange={(event) => update(index, event.target.value)} placeholder={`Player ${index + 1}`} maxLength={24} /></label><button className="remove-player" type="button" aria-label={`Remove player ${index + 1}`} disabled={players.length <= 2} onClick={() => remove(index)}>Remove</button></div>)}</div><button className="button secondary" type="button" onClick={() => onChange([...players, ""])}>Add player</button></section>;
}

function PartyGameScreen({ game, remaining, audio, audioMessage, onStartTurn, onAnswer, onContinue, onRetryAudio, onAudioError }: { game: PartyGameState; remaining: number; audio: React.RefObject<HTMLAudioElement | null>; audioMessage: string | null; onStartTurn: () => void; onAnswer: (id: string | null) => void; onContinue: () => void; onRetryAudio: () => void; onAudioError: () => void }) {
  const question = game.questions[game.currentRound]!;
  const activePlayer = game.players[game.currentPlayerIndex]!;
  return <main className="game-screen party-screen"><audio ref={audio} onError={onAudioError} preload="metadata" /><header className="game-header"><a className="brand" href="/">GUESSTIFY</a><span>ROUND {game.currentRound + 1}/{game.totalRounds}</span><strong>PARTY</strong></header><PlayerStrip players={game.players} activePlayerId={game.phase === "ROUND_RESULT" ? null : activePlayer.id} />{game.phase === "STARTING" ? <section className="handoff"><p className="eyebrow">{game.currentPlayerIndex === 0 ? "LISTEN TOGETHER" : "PASS THE DEVICE"}</p><h1>{game.currentPlayerIndex === 0 ? "Everybody listen." : `Hand it to ${activePlayer.displayName}.`}</h1><p>{game.currentPlayerIndex === 0 ? "The preview is playing once for the whole party. When everyone is ready, begin the first private turn." : "The previous answer is locked and hidden. Only this player should look at the screen."}</p><button className="audio-control" onClick={onRetryAudio}>▶ Play preview</button>{audioMessage && <p className="audio-message">{audioMessage}</p>}<button className="button primary" onClick={onStartTurn}>Start {activePlayer.displayName}’s turn</button></section> : game.phase === "ANSWERING" ? <section className="question"><div className={`timer ${remaining <= 3_000 ? "urgent" : ""}`} aria-live="polite">{formatTime(remaining)}<small>seconds</small></div><p className="eyebrow">{activePlayer.displayName.toUpperCase()}’S TURN</p><h1>Choose your answer.</h1><p className="turn-note">Keep your choice private, then pass the device on.</p><div className="answers">{question.choices.map((choice, index) => <button key={choice.trackId} className="answer" onClick={() => onAnswer(choice.trackId)}><span>{String.fromCharCode(65 + index)}</span><strong>{choice.title}</strong><small>{choice.artist}</small></button>)}</div></section> : <section className="party-round-result"><p className="eyebrow">ROUND REVEAL</p><h1>{question.trackName}</h1><p className="lead">{question.artist} was the correct answer.</p><div className="round-answers">{game.result?.playerResults.map((result) => { const player = game.players.find((candidate) => candidate.id === result.playerId)!; const choice = result.selectedTrackId ? question.choices.find((candidate) => candidate.trackId === result.selectedTrackId) : null; return <div className={result.isCorrect ? "round-answer correct" : "round-answer wrong"} key={result.playerId}><span className="player-avatar">{player.displayName.charAt(0).toUpperCase()}</span><div><strong>{player.displayName}</strong><small>{choice ? choice.title : "No answer"}</small></div><b>{result.isCorrect ? `+${result.score}` : "+0"}</b></div>; })}</div><button className="button primary" onClick={onContinue}>{game.currentRound + 1 === game.totalRounds ? "See leaderboard" : "Next round"}</button></section>}</main>;
}

function PlayerStrip({ players, activePlayerId }: { players: PartyGameState["players"]; activePlayerId: string | null }) { return <div className="player-strip" aria-label="Party scores">{players.map((player) => <div className={player.id === activePlayerId ? "active" : ""} key={player.id}><span className="player-avatar">{player.displayName.charAt(0).toUpperCase()}</span><span><strong>{player.displayName}</strong><small>{player.score.toLocaleString()} pts</small></span></div>)}</div>; }

function PartyResults({ game, historyMessage, onReplay, onNewGame }: { game: PartyGameState; historyMessage: string | null; onReplay: () => void; onNewGame: () => void }) { const leaderboard = rankPlayers(game.players, game.totalRounds); const winner = leaderboard[0]; return <main className="screen party-results"><p className="eyebrow">PARTY COMPLETE</p><h1>{winner?.displayName} wins</h1><p className="lead">{winner?.score.toLocaleString()} points across {game.totalRounds} rounds</p><ol className="leaderboard">{leaderboard.map((player) => <li className={player.rank === 1 ? "winner" : ""} key={player.id}><b>#{player.rank}</b><span className="player-avatar">{player.displayName.charAt(0).toUpperCase()}</span><div><strong>{player.displayName}</strong><small>{player.correctAnswers}/{game.totalRounds} correct · {player.accuracy}% accuracy · {player.averageResponseTime?.toFixed(2) ?? "—"}s avg</small></div><em>{player.score.toLocaleString()}</em></li>)}</ol>{historyMessage && <p className="history-message">{historyMessage}</p>}<div className="result-actions"><button className="button primary" onClick={onReplay}>Play again</button><button className="button secondary" onClick={onNewGame}>New game</button></div></main>; }

function RecentGames({ onBack }: { onBack: () => void }) { const [games, setGames] = useState<Array<{ id: string; playedAt: string; mode: string; sourceName: string; score: number; correctAnswers: number; totalRounds: number; accuracy: number }> | null>(null); const [error, setError] = useState<string | null>(null); useEffect(() => { void request<Array<{ id: string; playedAt: string; mode: string; sourceName: string; score: number; correctAnswers: number; totalRounds: number; accuracy: number }>>("/api/history").then(setGames).catch((caught) => setError(caught instanceof Error ? caught.message : "Could not load your recent games.")); }, []); return <main className="screen recent-games"><header className="topbar"><a className="brand" href="/">GUESSTIFY</a><button className="text-button" onClick={onBack}>Back to play</button></header><section className="setup"><p className="eyebrow">RECENT GAMES</p><h1>Your last listens.</h1>{error && <div className="notice error" role="alert">{error}</div>}{games === null && !error ? <p className="lead">Loading your games…</p> : games?.length ? <ol className="history-list">{games.map((game) => <li key={game.id}><div><strong>{game.sourceName}</strong><small>{game.mode} · {new Date(game.playedAt).toLocaleDateString()} · {game.correctAnswers}/{game.totalRounds} correct · {game.accuracy}% accuracy</small></div><b>{game.score.toLocaleString()}</b></li>)}</ol> : <div className="notice">No saved games yet. Finish a game while logged in and it will appear here.</div>}</section></main>; }
