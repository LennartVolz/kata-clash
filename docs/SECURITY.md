# Sicherheitskonzept

Fremden Code auszuführen ist das größte Risiko des Projekts. Grundsatz: **Der Runner wird als feindlich betrachtet.**

## Sandbox

| Maßnahme       | Umsetzung                                                                   |
| -------------- | --------------------------------------------------------------------------- |
| Isolation      | Ein frischer Container pro Ausführung, danach sofort löschen                |
| Netzwerk       | `--network none`                                                            |
| Dateisystem    | `--read-only`, nur kleines tmpfs für Temp-Dateien                           |
| Ressourcen     | `--memory`, `--cpus`, `--pids-limit`, Zeitlimit mit hartem Kill             |
| Rechte         | Nicht-root-User, `--cap-drop ALL`, `no-new-privileges`, Standard-seccomp    |
| Ausgabe        | Größenlimit für stdout/stderr, danach abgeschnitten                         |
| Docker-Zugriff | Runner-Prozess läuft getrennt vom Web-Server; kein Docker-Socket in Web/API |

Für höhere Sicherheit später: gVisor (`runsc`) oder Firecracker statt Standard-runc, oder Runner auf separaten Hosts.

## Weitere Maßnahmen

- Rate-Limits pro Nutzer für `code:run` und `code:submit`.
- Alle Socket-Payloads serverseitig mit Zod validieren; Codegröße begrenzen.
- Versteckte Testfälle verlassen den Server nie.
- Autoritative Serverlogik für Zeit, Sieger und Elo.
- Chat: Längenlimit, Rate-Limit, HTML-Escaping; Moderation/Report später.
- Secrets nur über Umgebungsvariablen, nie im Repo.
- Abhängigkeits-Updates und `pnpm audit` in der CI.
