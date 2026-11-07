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

| Bereich         | Technologie                                                          |
| --------------- | -------------------------------------------------------------------- |
| Frontend        | Next.js (App Router), React, TypeScript, Tailwind CSS, Monaco Editor |
| Echtzeit        | Node.js, Socket.IO                                                   |
| API/Backend     | Node.js, TypeScript (Fastify), Zod                                   |
| Datenbank       | PostgreSQL + Prisma                                                  |
| Cache/Queue     | Redis (Matchmaking, Pub/Sub, Job-Queue für Runner)                   |
| Code-Ausführung | Docker (isolierte, ressourcenbegrenzte Sandbox-Container)            |
| Auth            | Auth.js (GitHub-/Credentials-Login)                                  |
| Tooling         | pnpm-Monorepo, ESLint, Vitest, Playwright, GitHub Actions            |

## Geplante Projektstruktur

```
kata-clash/
├── apps/
│   ├── web/          # Next.js Frontend
│   ├── server/       # API + Socket.IO Gateway
│   └── runner/       # Worker: führt Code in Docker-Sandboxes aus
├── packages/
│   ├── db/           # Prisma-Schema, Client und Nutzerfunktionen
│   ├── shared/       # geteilte Typen, Zod-Schemas, Event-Definitionen
│   ├── katas/        # Kata-Definitionen (Beschreibung, Starter-Code, Tests)
│   └── elo/          # Elo-Berechnung (rein, gut testbar)
├── docker/           # Dockerfiles (Runner-Images pro Sprache)
├── docs/             # Architektur, Roadmap, Security
└── docker-compose.yml
```

## Dokumentation

- [Architektur](docs/ARCHITECTURE.md)
- [Roadmap](docs/ROADMAP.md)
- [Sicherheitskonzept](docs/SECURITY.md)

## Status

✅ Phase 0 abgeschlossen: Monorepo-Gerüst steht.
✅ Phase 1 abgeschlossen: Sandbox-Runner für JavaScript und Python mit Test-Harness, Härtung
und Limit-Tests.
✅ Phase 2 abgeschlossen: Kata-Bibliothek (8 Katas), REST-API und Next.js-Oberfläche mit
Monaco-Editor.
✅ Phase 3 abgeschlossen: Prisma-Schema samt Migration und Login über Auth.js
(E-Mail/Passwort, optional GitHub) mit Profilseite.
✅ Phase 4 abgeschlossen: Socket.IO-Gateway mit Auth.js-Handshake, Redis-Matchmaking und
Match-Lebenszyklus samt Timer, Reconnect und Elo-Update. Die Duell-Oberfläche unter `/duell`
verbindet sich per Socket.IO mit dem Gateway.

## Entwicklung

Voraussetzungen: Node.js 22+, pnpm 10 (`corepack enable`), Docker.

```bash
cp .env.example .env     # lokale Konfiguration
pnpm install
pnpm infra:up            # PostgreSQL + Redis starten
pnpm db:migrate          # Prisma-Migrationen anwenden (nach infra:up)
pnpm dev:server          # API auf http://localhost:4000/health
pnpm dev:web             # Oberfläche auf http://localhost:3000 (API muss laufen)

pnpm runner:images                       # Sandbox-Images bauen (JavaScript, Python)
pnpm runner:job fixtures/js-sum.json     # einzelnen Kata-Job ausführen

pnpm format:check && pnpm lint && pnpm typecheck && pnpm test
```

`pnpm dev:server` startet zusätzlich das Socket.IO-Gateway, sobald `AUTH_SECRET` und `REDIS_URL`
gesetzt sind (siehe `.env.example`); ohne die beiden Variablen läuft nur die REST-API. Matchmaking
und Matches brauchen `pnpm infra:up` (Redis + PostgreSQL). Der Browser verbindet sich über
`NEXT_PUBLIC_SERVER_URL` (Standard `http://localhost:4000`) per Socket.IO; `WEB_ORIGIN` muss die
Adresse der Web-App erlauben. Beide Apps laden beim Start die `.env` aus dem Repo-Root; bereits
gesetzte Umgebungsvariablen haben Vorrang. `AUTH_SECRET` muss in Web und Server identisch sein.
