'use client';

import type { KataDetail, Language, RunResponse, TestOutcome } from '@kata-clash/shared';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useState } from 'react';

import { DIFFICULTY_LABELS } from '@/lib/labels';

const MonacoEditor = dynamic(() => import('@monaco-editor/react'), {
  ssr: false,
  loading: () => <div className="editor-loading">Editor lädt …</div>,
});

const LANGUAGES: Language[] = ['javascript', 'python'];

const LANGUAGE_LABELS: Record<Language, string> = {
  javascript: 'JavaScript',
  python: 'Python',
};

export function KataClient({ kata }: { kata: KataDetail }) {
  const [language, setLanguage] = useState<Language>('javascript');
  const [codes, setCodes] = useState<Record<Language, string>>({ ...kata.starterCode });
  const [result, setResult] = useState<RunResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const code = codes[language];

  function updateCode(value: string | undefined) {
    setCodes((current) => ({ ...current, [language]: value ?? '' }));
  }

  function resetCode() {
    setCodes((current) => ({ ...current, [language]: kata.starterCode[language] }));
    setResult(null);
    setError(null);
  }

  async function run() {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch('/api/run', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ slug: kata.slug, language, code }),
      });
      const body = (await response.json().catch(() => null)) as
        RunResponse | { error?: string } | null;

      if (!response.ok || !body || !('status' in body)) {
        setError(
          (body && 'error' in body && body.error) || `Server antwortet mit ${response.status}`,
        );
        return;
      }
      setResult(body);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : String(requestError));
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="kata-page">
      <div className="kata-head">
        <Link className="back-link" href="/">
          ← Alle Katas
        </Link>
        <h1>{kata.title}</h1>
        <div className="kata-badges">
          <span className={`badge badge-${kata.difficulty}`}>
            {DIFFICULTY_LABELS[kata.difficulty]}
          </span>
          <span className="muted">{Math.round(kata.timeLimitSec / 60)} min im Duell</span>
        </div>
      </div>

      <div className="kata-layout">
        <aside className="panel">
          <div className="panel-body">
            <p className="description">{kata.description}</p>
            <h2 className="section-title">Sichtbare Tests</h2>
            <ul className="test-list">
              {kata.tests.map((test) => (
                <li key={test.id} className="test-item">
                  <span className="test-name">{test.name}</span>
                  <code className="test-args">
                    {kata.functionName}({test.args.map((arg) => JSON.stringify(arg)).join(', ')})
                  </code>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <section className="editor-column">
          <div className="panel">
            <div className="toolbar">
              <div className="tabs" role="tablist" aria-label="Sprache">
                {LANGUAGES.map((item) => (
                  <button
                    key={item}
                    type="button"
                    role="tab"
                    aria-selected={language === item}
                    className="tab"
                    onClick={() => {
                      setLanguage(item);
                      setResult(null);
                      setError(null);
                    }}
                  >
                    {LANGUAGE_LABELS[item]}
                  </button>
                ))}
              </div>
              <div className="toolbar-actions">
                <button
                  type="button"
                  className="ghost-button"
                  onClick={resetCode}
                  disabled={pending}
                >
                  Zurücksetzen
                </button>
                <button type="button" className="run-button" onClick={run} disabled={pending}>
                  {pending ? 'Läuft …' : 'Tests ausführen'}
                </button>
              </div>
            </div>
            <div className="editor-wrap">
              <MonacoEditor
                height="440px"
                language={language}
                theme="vs-dark"
                value={code}
                onChange={updateCode}
                options={{
                  minimap: { enabled: false },
                  fontSize: 14,
                  tabSize: language === 'python' ? 4 : 2,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  padding: { top: 12 },
                }}
              />
            </div>
          </div>

          {error && <div className="notice notice-error">{error}</div>}
          {result && <ResultPanel result={result} functionName={kata.functionName} />}
        </section>
      </div>
    </div>
  );
}

function ResultPanel({ result, functionName }: { result: RunResponse; functionName: string }) {
  const allPassed = result.status === 'passed';
  const headline = allPassed
    ? 'Alle sichtbaren Tests bestanden'
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
          <ResultRow key={test.id} test={test} functionName={functionName} />
        ))}
      </ul>
      {result.output.trim() !== '' && (
        <details className="output">
          <summary>Konsolenausgabe anzeigen</summary>
          <pre>{result.output}</pre>
        </details>
      )}
    </div>
  );
}

function ResultRow({ test, functionName }: { test: TestOutcome; functionName: string }) {
  return (
    <li className="result-row">
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
      <span className="result-duration">
        {test.passed ? '' : `${functionName}() · `}
        {Math.round(test.durationMs)} ms
      </span>
    </li>
  );
}
