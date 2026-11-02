# ⚔️ Kata Clash

Echtzeit-Code-Duelle: Zwei Entwickler bekommen dieselbe kleine Programmieraufgabe (Kata) und treten live gegeneinander an. Wer zuerst alle Testfälle besteht, gewinnt – und steigt im Elo-Ranking auf.

## Features

- **1v1-Duelle in Echtzeit** mit Matchmaking (Warteschlange nach Elo-Nähe)
- **Live-Code-Editor** (Monaco) mit Syntax-Highlighting
- **Sichere Code-Ausführung** in isolierten Docker-Containern
- **Live-Chat** pro Duell und Zuschauer-Modus (read-only, ohne Code-Einsicht bis Ende, optional)
- **Elo-Rangliste** (global, pro Sprache später)
- Kata-Katalog mit Schwierigkeitsgraden und versteckten Testfällen

## Tech-Stack

| Bereich | Technologie |
|---|---|
| Frontend | Next.js (App Router), React, TypeScript, Tailwind CSS, Monaco Editor |
| Echtzeit | Node.js, Socket.IO |
| API/Backend | Node.js, TypeScript (Fastify), Zod |
| Datenbank | PostgreSQL + Prisma |
| Cache/Queue | Redis (Matchmaking, Pub/Sub, Job-Queue für Runner) |
| Code-Ausführung | Docker (isolierte, ressourcenbegrenzte Sandbox-Container) |
| Auth | Auth.js (GitHub-/Credentials-Login) |
| Tooling | pnpm-Monorepo, ESLint, Vitest, Playwright, GitHub Actions |

## Geplante Projektstruktur

```
kata-clash/
├── apps/
│   ├── web/          # Next.js Frontend
│   ├── server/       # API + Socket.IO Gateway
│   └── runner/       # Worker: führt Code in Docker-Sandboxes aus
├── packages/
│   ├── shared/       # geteilte Typen, Zod-Schemas, Event-Definitionen
│   └── elo/          # Elo-Berechnung (rein, gut testbar)
├── katas/            # Kata-Definitionen (Markdown + Tests als Dateien)
├── docker/           # Dockerfiles (Runner-Images pro Sprache)
├── docs/             # Architektur, Roadmap, Security
└── docker-compose.yml
```

## Dokumentation

- [Architektur](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Sicherheitskonzept](docs/SECURITY.md)

## Status

🧭 Planungsphase – noch kein lauffähiger Code.
