# Architektur

## Überblick

```
┌──────────────┐  HTTPS   ┌───────────────┐        ┌────────────┐
│  Next.js Web │◄────────►│  API (Fastify)│◄──────►│ PostgreSQL │
│  Monaco, UI  │          └───────┬───────┘        └────────────┘
└──────┬───────┘                  │
       │ WebSocket (Socket.IO)    │ Redis (Pub/Sub, Queue)
       ▼                          ▼
┌──────────────┐          ┌───────────────┐   docker run   ┌──────────────┐
│ Realtime GW  │◄────────►│     Redis     │◄──────────────►│ Runner-Worker│
│ (Socket.IO)  │          └───────────────┘                │ → Sandbox    │
└──────────────┘                                           └──────────────┘
```

API und Realtime-Gateway laufen anfangs im selben Node-Prozess (`apps/server`) und lassen sich später trennen. Der Runner ist ein separater Prozess, damit Code-Ausführung die Echtzeit-Latenz nicht beeinflusst und unabhängig skaliert werden kann.

## Duell-Ablauf

1. Spieler tritt der Matchmaking-Queue bei (Redis Sorted Set nach Elo).
2. Matcher paart Spieler mit ähnlicher Elo (Toleranz wächst mit Wartezeit).
3. Server erstellt `Match`, wählt Kata, schickt `match:found` an beide.
4. Countdown, dann `match:start` mit Aufgabenbeschreibung, Starter-Code, Zeitlimit.
5. Spieler tippt; Editor-Inhalt wird gedrosselt (z. B. alle 500 ms) an Zuschauer gespiegelt (optional).
6. `submit` → Job in Runner-Queue → Sandbox führt Tests aus → Ergebnis zurück.
7. Erster Submit mit allen Tests grün gewinnt; Match endet, Elo wird berechnet.
8. Bei Zeitablauf: Sieger nach bestandenen Tests, sonst Remis.

Der Server ist autoritativ: Zeit, Sieger und Elo werden ausschließlich serverseitig entschieden.

## Socket.IO-Events (Entwurf)

| Richtung | Event                        | Payload                                   |
| -------- | ---------------------------- | ----------------------------------------- |
| C→S      | `queue:join` / `queue:leave` | `{ language }`                            |
| S→C      | `match:found`                | `{ matchId, opponent }`                   |
| S→C      | `match:start`                | `{ kata, startsAt, endsAt }`              |
| C→S      | `code:update`                | `{ matchId, code }` (gedrosselt)          |
| C→S      | `code:run`                   | `{ matchId, code }` (nur sichtbare Tests) |
| C→S      | `code:submit`                | `{ matchId, code }` (alle Tests)          |
| S→C      | `run:result`                 | `{ passed, failed, output }`              |
| S→C      | `opponent:progress`          | `{ testsPassed, total }` (ohne Code)      |
| S→C      | `match:end`                  | `{ winnerId, eloDelta }`                  |
| C↔S      | `chat:message`               | `{ matchId, text }`                       |
| C→S      | `spectate:join`              | `{ matchId }`                             |

Alle Payloads werden mit Zod-Schemas aus `packages/shared` auf Server und Client validiert.

## Datenmodell (Entwurf)

- **User**: id, name, avatarUrl, elo (Start 1200), wins, losses, createdAt
- **Kata**: id, slug, title, description, difficulty, timeLimitSec, starterCode (pro Sprache), tests (sichtbar/versteckt)
- **Match**: id, kataId, status, startedAt, endedAt, winnerId
- **MatchPlayer**: matchId, userId, eloBefore, eloAfter, finalCode, testsPassed, finishedAt
- **ChatMessage**: id, matchId, userId, text, createdAt

## Elo-System

Erwartungswert: `E_A = 1 / (1 + 10^((R_B − R_A) / 400))`
Update: `R_A' = R_A + K · (S_A − E_A)`, mit `S = 1` Sieg, `0,5` Remis, `0` Niederlage.
`K = 40` für die ersten 30 Matches, danach `K = 20`. Startwert 1200. Implementiert als reine Funktion in `packages/elo` mit Unit-Tests.

## Code-Ausführung (Runner)

- Pro Run ein frischer Container aus einem vorgebauten Sprach-Image (zunächst JavaScript/TypeScript und Python).
- Code und Testeingaben werden per read-only Volume hineingereicht; Erwartungswerte bleiben im
  Runner. Der Container liefert nur die Rückgabewerte als JSON über stdout, verglichen wird außerhalb
  der Sandbox (siehe [SECURITY.md](SECURITY.md)).
- Harte Limits: CPU, RAM, PIDs, Laufzeit, Ausgabegröße; kein Netzwerk; read-only Root-FS.
- Details siehe [SECURITY.md](SECURITY.md).

## REST-API (Phase 2)

| Endpunkt           | Zweck                                                                    |
| ------------------ | ------------------------------------------------------------------------ |
| `GET /katas`       | Katalog mit Slug, Titel, Schwierigkeit und Testanzahl                    |
| `GET /katas/:slug` | Kata mit Beschreibung, Starter-Code für beide Sprachen, sichtbaren Tests |
| `POST /runs`       | `{ slug, language, code }` gegen die sichtbaren Tests ausführen          |

`POST /runs` baut aus Kata und Code einen Runner-Job und startet die Runner-CLI als
Kindprozess (`apps/server/src/runner.ts`). Versteckte Tests bleiben im Server. Die Next-App
spricht nur mit ihrer eigenen Route `/api/run`; die reicht die Anfrage an die API weiter, damit
die API keine CORS-Konfiguration braucht.

## Auth und Daten (Phase 3)

- **`packages/db`** enthält das Prisma-Schema, den generierten Client (Prisma 7, `prisma-client`
  mit Pflicht-`output`) und die Nutzerfunktionen. Verbindung über den `@prisma/adapter-pg`-Treiber.
- **Auth.js** läuft im Next-Prozess (`apps/web/auth.ts`): Prisma-Adapter, JWT-Sessions und ein
  Credentials-Provider mit scrypt-Hashes aus `node:crypto`. GitHub ist optional und nur aktiv,
  wenn `AUTH_GITHUB_ID`/`AUTH_GITHUB_SECRET` gesetzt sind.
- Registrierung erfolgt über `POST /api/register`; das Profil unter `/profil` liest den Nutzer
  serverseitig über die Session-ID. `/login` und `/registrieren` sind öffentlich.
- Migrationen werden versioniert committet. Ohne laufende Datenbank lassen sie sich mit
  `prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script` erzeugen und
  später mit `prisma migrate deploy` anwenden.

## Skalierung

- Socket.IO mit Redis-Adapter erlaubt mehrere Gateway-Instanzen.
- Runner-Worker horizontal skalierbar über die Job-Queue (z. B. BullMQ).
- Matchmaking-State liegt in Redis, nicht im Prozessspeicher.

## Zentrale Entscheidungen

| Frage                         | Entscheidung                                | Begründung                                             |
| ----------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| Socket.IO vs. rohe WebSockets | Socket.IO                                   | Rooms, Reconnect, Redis-Adapter fertig vorhanden       |
| Code-Sync                     | nur Fortschritt, kein Live-Code des Gegners | verhindert Abschreiben; Zuschauer ggf. mit Verzögerung |
| Sprachen im MVP               | JavaScript + Python                         | einfache, schnelle Sandbox-Images                      |
| Monorepo                      | pnpm Workspaces                             | geteilte Typen zwischen Client und Server              |
