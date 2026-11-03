# Roadmap

## Phase 0 – Fundament

- [x] pnpm-Monorepo, TypeScript, ESLint, Prettier
- [x] `docker-compose.yml` mit PostgreSQL und Redis
- [x] CI (Format, Lint, Typecheck, Tests)

## Phase 1 – Sandbox-Runner (Kern-Risiko zuerst)

- [x] Runner-Image für JavaScript, Test-Harness mit JSON-Ausgabe
- [x] Ausführung mit allen Limits aus [SECURITY.md](SECURITY.md)
- [x] Tests mit Endlosschleife, Speicherbombe, Netzwerkzugriff, Fork-Bombe
- [x] Python-Image

Die Container-Tests (`apps/runner/src/execute.test.ts`) brauchen einen erreichbaren Docker-Daemon
und gebaute Images (`pnpm runner:images`); ohne beides werden sie übersprungen. Die Anbindung an
die Redis-Queue folgt in Phase 4 – aktuell nimmt der Runner einen Job als JSON-Datei oder über
stdin entgegen.

## Phase 2 – Single-Player-Kata (ohne Echtzeit)

- [x] Next.js-Seite mit Monaco Editor
- [x] Kata-Format (Beschreibung, Starter-Code, Tests) und 5–10 Beispiel-Katas
- [x] Run/Submit über REST, Ergebnisanzeige

Die acht Beispiel-Katas liegen in `packages/katas`, die REST-Endpunkte in `apps/server`
(`GET /katas`, `GET /katas/:slug`, `POST /runs`) und die Oberfläche in `apps/web`. `POST /runs`
führt nur die sichtbaren Tests aus; das Bewerten versteckter Tests gehört zum Duell in Phase 4.

## Phase 3 – Auth und Datenbank

- [x] Prisma-Schema und Migrationen
- [x] Login (Auth.js), Nutzerprofil

Das Schema liegt in `packages/db` (Nutzer, OAuth-Konten, Sessions) mit der Initial-Migration
unter `packages/db/prisma/migrations`. Der Login läuft über Auth.js im Next-Prozess: Credentials
(E-Mail + Passwort, scrypt) sind immer aktiv, GitHub nur wenn `AUTH_GITHUB_ID` und
`AUTH_GITHUB_SECRET` gesetzt sind. Sessions sind JWTs; die `Session`-Tabelle ist für OAuth
vorbereitet. Die API selbst bleibt in Phase 3 noch ohne Auth – sie schützt in Phase 4 die
Duell-Endpunkte.

## Phase 4 – Echtzeit-Duell (MVP-Kern)

- [ ] Socket.IO-Gateway, geteilte Event-Typen
- [ ] Matchmaking-Queue, Match-Lebenszyklus, Timer
- [ ] Gegner-Fortschritt, Siegbedingung, Reconnect-Handling

## Phase 5 – Elo und Rangliste

- [x] `packages/elo` mit Tests
- [ ] Elo-Update nach Matchende
- [ ] Rangliste und Profilstatistik

## Phase 6 – Chat und Zuschauer

- [ ] Duell-Chat
- [ ] Zuschauer-Modus (read-only, Zuschauerzahl)

## Phase 7 – Härtung und Betrieb

- [ ] Rate-Limits, Missbrauchsschutz, Monitoring
- [ ] E2E-Tests (Playwright) mit zwei simulierten Spielern
- [ ] Deployment (Docker, separater Runner-Host)

## Später

- Weitere Sprachen, Turniere, Freunde herausfordern, Replays, Kata-Editor für Community
