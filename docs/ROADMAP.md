# Roadmap

## Phase 0 – Fundament

- [x] pnpm-Monorepo, TypeScript, ESLint, Prettier
- [x] `docker-compose.yml` mit PostgreSQL und Redis
- [x] CI (Format, Lint, Typecheck, Tests)

## Phase 1 – Sandbox-Runner (Kern-Risiko zuerst)

- [ ] Runner-Image für JavaScript, Test-Harness mit JSON-Ausgabe
- [ ] Ausführung mit allen Limits aus [SECURITY.md](SECURITY.md)
- [ ] Tests mit Endlosschleife, Speicherbombe, Netzwerkzugriff, Fork-Bombe
- [ ] Python-Image

## Phase 2 – Single-Player-Kata (ohne Echtzeit)

- [ ] Next.js-Seite mit Monaco Editor
- [ ] Kata-Format (Beschreibung, Starter-Code, Tests) und 5–10 Beispiel-Katas
- [ ] Run/Submit über REST, Ergebnisanzeige

## Phase 3 – Auth und Datenbank

- [ ] Prisma-Schema und Migrationen
- [ ] Login (Auth.js), Nutzerprofil

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
