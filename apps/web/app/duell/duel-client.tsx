'use client';

import type {
  ClientToServerPayloads,
  Language,
  MatchEnd,
  MatchEndReason,
  MatchFound,
  MatchStart,
  OpponentProgress,
  RunResultEvent,
  ServerToClientPayloads,
  SocketEventHandlers,
} from '@kata-clash/shared';
import dynamic from 'next/dynamic';
import { useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';

import { DIFFICULTY_LABELS } from '@/lib/labels';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="editor-loading">Editor lädt …</div>,
});

const SERVER_URL = process.env.NEXT_PUBLIC_SERVER_URL ?? 'http://localhost:4000';

const LANGUAGES: Language[] = ['javascript', 'python'];
const LANGUAGE_LABELS: Record<Language, string> = {
  javascript: 'JavaScript',
  python: 'Python',
};

const REASON_LABELS: Record<MatchEndReason, string> = {
  solved: 'Alle Tests bestanden',
  timeout: 'Zeit abgelaufen',
  forfeit: 'Gegner hat aufgegeben',
  abandoned: 'Match abgebrochen',
};

type Phase = 'idle' | 'queued' | 'found' | 'playing' | 'finished';

type DuelSocket = Socket<
  SocketEventHandlers<ServerToClientPayloads>,
  SocketEventHandlers<ClientToServerPayloads>
>;

export function DuelClient({ playerId, playerName }: { playerId: string; playerName: string }) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [language, setLanguage] = useState<Language>('javascript');
  const [connected, setConnected] = useState(false);
  const [connectError, setConnectError] = useState<string | null>(null);
  const [opponent, setOpponent] = useState<MatchFound['opponent'] | null>(null);
  const [kata, setKata] = useState<MatchStart['kata'] | null>(null);
  const [code, setCode] = useState('');
  const [startsAt, setStartsAt] = useState<number | null>(null);
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [opponentProgress, setOpponentProgress] = useState<OpponentProgress | null>(null);
  const [result, setResult] = useState<RunResultEvent | null>(null);
  const [outcome, setOutcome] = useState<MatchEnd | null>(null);
  const [busy, setBusy] = useState(false);
  const [matchId, setMatchId] = useState<string | null>(null);

  const socketRef = useRef<DuelSocket | null>(null);
  const phaseRef = useRef<Phase>('idle');
  const languageRef = useRef<Language>('javascript');

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    languageRef.current = language;
  }, [language]);

  useEffect(() => {
    const socket = io(SERVER_URL, {
      withCredentials: true,
    }) as unknown as DuelSocket;
    socketRef.current = socket;

    socket.on('connect', () => {
      setConnected(true);
      setConnectError(null);
      // Nach einem Abbruch wieder in die Warteschlange, falls das Duell noch nicht begann.
      if (phaseRef.current === 'queued') {
        socket.emit('queue:join', { language: languageRef.current });
      }
    });

    socket.on('disconnect', () => {
      setConnected(false);
      setBusy(false);
    });

    socket.on('connect_error', (error) => {
      setConnected(false);
      setConnectError(
        error.message === 'unauthorized'
          ? 'Sitzung abgelaufen – bitte melde dich neu an.'
          : `Echtzeit-Server nicht erreichbar (${SERVER_URL}). Läuft \`pnpm dev:server\`?`,
      );
    });

    socket.on('match:found', (payload) => {
      setMatchId(payload.matchId);
      setOpponent(payload.opponent);
      setStartsAt(payload.startsAt);
      setEndsAt(null);
      setKata(null);
      setCode('');
      setResult(null);
      setOutcome(null);
      setOpponentProgress(null);
      setBusy(false);
      setPhase('found');
    });

    socket.on('match:start', (payload) => {
      setMatchId(payload.matchId);
      setKata(payload.kata);
      setStartsAt(payload.startsAt);
      setEndsAt(payload.endsAt);
      // Beim Reconnect bleibt der bereits getippte Code erhalten.
      setCode((current) => current || payload.kata.starterCode[languageRef.current]);
      setPhase('playing');
    });

    socket.on('run:result', (payload) => {
      setResult(payload);
      setBusy(false);
    });

    socket.on('opponent:progress', (payload) => {
      setOpponentProgress(payload);
    });

    socket.on('match:end', (payload) => {
      setOutcome(payload);
      setPhase('finished');
      setBusy(false);
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (phase !== 'found' && phase !== 'playing') return;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [phase]);

  const secondsToStart = startsAt === null ? 0 : Math.max(0, Math.ceil((startsAt - now) / 1000));
  const secondsLeft = endsAt === null ? 0 : Math.max(0, Math.ceil((endsAt - now) / 1000));

  function joinQueue() {
    setPhase('queued');
    setConnectError(null);
    socketRef.current?.emit('queue:join', { language });
  }

  function leaveQueue() {
    socketRef.current?.emit('queue:leave', { language });
    setPhase('idle');
  }

  function runTests() {
    if (!matchId) return;
    setBusy(true);
    setResult(null);
    socketRef.current?.emit('code:run', { matchId, code });
  }

  function submit() {
    if (!matchId) return;
    setBusy(true);
    socketRef.current?.emit('code:submit', { matchId, code });
  }

  function reset() {
    setPhase('idle');
    setOpponent(null);
    setKata(null);
    setCode('');
    setStartsAt(null);
    setEndsAt(null);
    setOpponentProgress(null);
    setResult(null);
    setOutcome(null);
    setBusy(false);
    setMatchId(null);
  }

  return (
    <div className="duel-page">
      <div className="duel-head">
        <h1>⚔️ Live-Duell</h1>
        <p className="lede">
          Tritt gegen einen Spieler mit ähnlicher Elo an. Wer zuerst alle Tests besteht, gewinnt.
        </p>
      </div>

      {connectError && <div className="notice notice-error duel-connection">{connectError}</div>}
      {!connected && !connectError && phase !== 'idle' && (
        <div className="notice duel-connection">
          Verbindung getrennt – Socket.IO versucht automatisch erneut zu verbinden.
        </div>
      )}

      {phase === 'idle' && (
        <section className="panel duel-queue-panel">
          <div className="panel-body">
            <h2>Gegner suchen</h2>
            <p className="muted">
              Wähle die Sprache für dein Duell. Das Matchmaking sucht nach Elo-Nähe und weitet die
              Suche mit der Wartezeit aus.
            </p>
            <div className="tabs" role="tablist" aria-label="Sprache">
              {LANGUAGES.map((item) => (
                <button
                  key={item}
                  type="button"
                  role="tab"
                  aria-selected={language === item}
                  className="tab"
                  onClick={() => setLanguage(item)}
                >
                  {LANGUAGE_LABELS[item]}
                </button>
              ))}
            </div>
            <button type="button" className="run-button" onClick={joinQueue} disabled={!connected}>
              {connected ? 'Duell suchen' : 'Verbinde …'}
            </button>
            {!connected && <p className="muted">Echtzeit-Server: {SERVER_URL}</p>}
          </div>
        </section>
      )}

      {phase === 'queued' && (
        <section className="panel duel-queue-panel">
          <div className="panel-body">
            <h2>Warte auf Gegner …</h2>
            <p className="muted">{LANGUAGE_LABELS[language]} · Elo-basiertes Matchmaking</p>
            <p className="duel-pulse" aria-hidden>
              ⚔️
            </p>
            <button type="button" className="ghost-button" onClick={leaveQueue}>
              Warteschlange verlassen
            </button>
          </div>
        </section>
      )}

      {phase === 'found' && (
        <section className="panel duel-queue-panel">
          <div className="panel-body">
            <h2>Gegner gefunden</h2>
            <div className="duel-versus">
              <div>
                <span className="muted">Du</span>
                <strong>{playerName}</strong>
              </div>
              <span className="duel-vs">vs</span>
              <div>
                <span className="muted">Gegner</span>
                <strong>{opponent?.name ?? 'Unbekannt'}</strong>
                <span className="muted">{opponent?.elo ?? '–'} Elo</span>
              </div>
            </div>
            <p className="duel-countdown">
              {secondsToStart > 0 ? `${secondsToStart} s` : 'Gleich geht’s los …'}
            </p>
            <p className="muted">Die Kata erscheint beim Start des Duells.</p>
          </div>
        </section>
      )}

      {(phase === 'playing' || phase === 'finished') && kata && (
        <>
          {phase === 'finished' && outcome && (
            <OutcomePanel
              outcome={outcome}
              playerId={playerId}
              opponentName={opponent?.name ?? 'Gegner'}
              onReset={reset}
            />
          )}

          <div className="duel-statusbar">
            <div>
              <span className="section-title">Kata</span>
              <strong>{kata.title}</strong>
            </div>
            <span className={`badge badge-${kata.difficulty}`}>
              {DIFFICULTY_LABELS[kata.difficulty]}
            </span>
            <div className={`duel-timer ${secondsLeft <= 30 ? 'low' : ''}`} aria-label="Restzeit">
              {formatDuration(secondsLeft)}
            </div>
            <div className="duel-opponent">
              <span className="muted">
                {opponent?.name ?? 'Gegner'} · {opponentProgress?.testsPassed ?? 0}/
                {kata.totalTests} Tests
              </span>
              <div
                className="progress-track"
                role="progressbar"
                aria-label="Fortschritt des Gegners"
                aria-valuemin={0}
                aria-valuemax={kata.totalTests}
                aria-valuenow={opponentProgress?.testsPassed ?? 0}
              >
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(
                      100,
                      ((opponentProgress?.testsPassed ?? 0) / kata.totalTests) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>
          </div>

          <div className="kata-layout duel-layout">
            <aside className="panel">
              <div className="panel-body">
                <p className="description">{kata.description}</p>
                <h2 className="section-title">Sichtbare Tests</h2>
                <ul className="test-list">
                  {kata.tests.map((test) => (
                    <li key={test.id} className="test-item">
                      <span className="test-name">{test.name}</span>
                      <code className="test-args">
                        {kata.functionName}({test.args.map((arg) => JSON.stringify(arg)).join(', ')}
                        )
                      </code>
                    </li>
                  ))}
                </ul>
                <p className="muted">
                  {kata.totalTests} Tests insgesamt – versteckte Tests entscheiden über den Sieg.
                </p>
              </div>
            </aside>

            <section className="editor-column">
              <div className="panel">
                <div className="toolbar">
                  <span className="duel-language">{LANGUAGE_LABELS[language]}</span>
                  <div className="toolbar-actions">
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={runTests}
                      disabled={busy || phase === 'finished'}
                    >
                      {busy ? 'Läuft …' : 'Tests ausführen'}
                    </button>
                    <button
                      type="button"
                      className="run-button"
                      onClick={submit}
                      disabled={busy || phase === 'finished'}
                    >
                      Abgeben
                    </button>
                  </div>
                </div>
                <div className="editor-wrap">
                  <MonacoEditor
                    height="440px"
                    language={language}
                    theme="vs-dark"
                    value={code}
                    onChange={(value) => setCode(value ?? '')}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 14,
                      tabSize: language === 'python' ? 4 : 2,
                      scrollBeyondLastLine: false,
                      automaticLayout: true,
                      readOnly: phase === 'finished',
                      padding: { top: 12 },
                    }}
                  />
                </div>
              </div>

              {result && <DuelResultPanel result={result} />}
            </section>
          </div>
        </>
      )}
    </div>
  );
}

function OutcomePanel({
  outcome,
  playerId,
  opponentName,
  onReset,
}: {
  outcome: MatchEnd;
  playerId: string;
  opponentName: string;
  onReset: () => void;
}) {
  const draw = outcome.winnerId === null;
  const won = outcome.winnerId === playerId;
  const tone = draw ? 'draw' : won ? 'win' : 'loss';
  const headline = draw ? 'Remis' : won ? 'Du hast gewonnen!' : 'Du hast verloren';

  return (
    <div className={`panel duel-outcome ${tone}`}>
      <div className="panel-body">
        <span className="section-title">Match beendet · {REASON_LABELS[outcome.reason]}</span>
        <h2>{headline}</h2>
        <p className="muted">Gegner: {opponentName}</p>
        <p className={`duel-elo ${outcome.eloDelta >= 0 ? 'positive' : 'negative'}`}>
          {outcome.eloDelta > 0 ? '+' : ''}
          {outcome.eloDelta} Elo
        </p>
        <button type="button" className="run-button" onClick={onReset}>
          Neues Duell
        </button>
      </div>
    </div>
  );
}

function DuelResultPanel({ result }: { result: RunResultEvent }) {
  const allPassed = result.status === 'passed';
  const headline = allPassed
    ? result.kind === 'submit'
      ? 'Alle Tests bestanden'
      : 'Alle sichtbaren Tests bestanden'
    : result.status === 'timeout'
      ? 'Zeitlimit überschritten'
      : result.status === 'error'
        ? 'Ausführung fehlgeschlagen'
        : `${result.passedTests} von ${result.totalTests} Tests bestanden`;

  return (
    <div className={`panel result-panel ${allPassed ? 'result-passed' : 'result-failed'}`}>
      <div className="result-head">
        <strong>{headline}</strong>
        <span className="muted">{Math.round(result.durationMs)} ms</span>
      </div>
      {result.error && <p className="result-error">{result.error}</p>}
      <ul className="test-list">
        {result.tests.map((test) => (
          <li key={test.id} className="result-row">
            <span className={`result-icon ${test.passed ? 'passed' : 'failed'}`}>
              {test.passed ? '✓' : '✕'}
            </span>
            <span>
              <span className="test-name">{test.name}</span>
              {test.error && (
                <span className="result-detail">
                  <br />
                  {test.error}
                </span>
              )}
            </span>
            <span className="result-duration">{Math.round(test.durationMs)} ms</span>
          </li>
        ))}
      </ul>
      {result.kind === 'submit' && (
        <p className="duel-result-note">Versteckte Tests werden nur gezählt, nicht angezeigt.</p>
      )}
      {result.output.trim() !== '' && (
        <details className="output">
          <summary>Konsolenausgabe anzeigen</summary>
          <pre>{result.output}</pre>
        </details>
      )}
    </div>
  );
}

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
