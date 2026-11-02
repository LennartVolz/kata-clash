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

## Umsetzung im Runner (Phase 1)

`apps/runner` setzt die Tabelle als `docker run`-Flags um (`buildDockerArgs` in
`apps/runner/src/docker.ts`):

| Maßnahme    | Flag / Wert                                                                  |
| ----------- | ---------------------------------------------------------------------------- |
| Netzwerk    | `--network none`                                                             |
| Dateisystem | `--read-only`, `--tmpfs /tmp:rw,noexec,nosuid,nodev,size=16m`, Code `:ro`    |
| Speicher    | `--memory 256m` und `--memory-swap 256m` (deaktiviert Swap)                  |
| CPU         | `--cpus 1`                                                                   |
| Prozesse    | `--pids-limit 64`, `--ulimit nofile=64:64`, `--init` (Zombie-Reaping)        |
| Rechte      | `--user 10001:10001`, `--cap-drop ALL`, `--security-opt no-new-privileges`   |
| Zeitlimit   | `docker kill` nach Ablauf, nach 3 s `docker rm -f`; Exit-Code 137 = OOM/Kill |
| Ausgabe     | stdout/stderr werden pro Stream bei 64 KiB abgeschnitten                     |
| Aufräumen   | `--rm` plus Arbeitsverzeichnis löschen; ein Container pro Ausführung         |

Ergänzend:

- **Erwartungswerte bleiben im Runner.** Der Container bekommt nur Code und Eingaben
  (`/work/input.json`), nie die erwarteten Ergebnisse; verglichen wird außerhalb der Sandbox.
  Damit lassen sich versteckte Tests nicht aus der Sandbox auslesen.
- **Das Harness ist ins Image eingebacken** (`/opt/kata/harness.*`) und besitzt stdout:
  `console.log`/`print` des Nutzercodes landen auf stderr und können die Auswertung nicht fälschen.
- `process.exit` ist im Harness blockiert, `sys.stdout` in Python umgeleitet; Ausnahmen werden
  pro Testfall gemeldet.
- **Grenze:** Standard-runc teilt den Kernel mit dem Host, ein Kernel-Exploit bleibt denkbar.
  Deshalb später gVisor/Firecracker oder separate Runner-Hosts (Phase 7).

## Weitere Maßnahmen

- Rate-Limits pro Nutzer für `code:run` und `code:submit`.
- Alle Socket-Payloads serverseitig mit Zod validieren; Codegröße begrenzen.
- Versteckte Testfälle verlassen den Server nie.
- Autoritative Serverlogik für Zeit, Sieger und Elo.
- Chat: Längenlimit, Rate-Limit, HTML-Escaping; Moderation/Report später.
- Secrets nur über Umgebungsvariablen, nie im Repo.
- Abhängigkeits-Updates und `pnpm audit` in der CI.
