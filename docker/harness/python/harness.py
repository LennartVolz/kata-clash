"""Test-Harness für Python-Katas. Läuft im Sandbox-Container.

Vertrag: liest /work/input.json und /work/solution.py, ruft die Nutzerfunktion
für jede Testeingabe auf und schreibt genau eine JSON-Zeile auf stdout.
Erwartungswerte kennt das Harness nicht – der Vergleich passiert im Runner.
"""

from __future__ import annotations

import json
import os
import sys

INPUT_PATH = os.environ.get("KATA_INPUT", "/work/input.json")
CODE_PATH = os.environ.get("KATA_CODE", "/work/solution.py")

_real_stdout = sys.stdout


class _StderrWriter:
    """Leitet Ausgaben des Nutzercodes nach stderr um, damit stdout sauber bleibt."""

    encoding = "utf-8"
    errors = "strict"

    def __init__(self) -> None:
        self.buffer = sys.stderr.buffer

    def write(self, data: str) -> int:
        return sys.stderr.write(data)

    def writelines(self, lines) -> None:
        for line in lines:
            self.write(line)

    def flush(self) -> None:
        sys.stderr.flush()

    def isatty(self) -> bool:
        return False

    def fileno(self) -> int:
        return sys.stderr.fileno()


def describe(error: BaseException) -> str:
    message = str(error).strip()
    return f"{type(error).__name__}: {message}" if message else type(error).__name__


def emit(payload: dict) -> None:
    _real_stdout.write(json.dumps(payload) + "\n")
    _real_stdout.flush()


def main() -> int:
    try:
        with open(INPUT_PATH, encoding="utf-8") as handle:
            job = json.load(handle)
    except (OSError, ValueError) as error:
        emit({"status": "load-error", "error": describe(error), "results": []})
        return 0

    function_name = job.get("functionName", "solve")
    tests = job.get("tests") or []

    # Ab hier gehören Ausgaben von print() nicht mehr zur Antwort.
    sys.stdout = _StderrWriter()

    namespace: dict = {"__name__": "__main__"}
    try:
        with open(CODE_PATH, encoding="utf-8") as handle:
            source = handle.read()
        exec(compile(source, "solution.py", "exec"), namespace)  # noqa: S102
        solution = namespace.get(function_name)
        if not callable(solution):
            raise LookupError(f"Funktion '{function_name}' nicht gefunden")
    except BaseException as error:  # noqa: BLE001 - auch SystemExit des Nutzercodes
        sys.stdout = _real_stdout
        message = describe(error)
        emit(
            {
                "status": "load-error",
                "error": message,
                "results": [
                    {"id": test.get("id"), "status": "error", "error": message} for test in tests
                ],
            }
        )
        return 0

    results = []
    for test in tests:
        try:
            value = solution(*test.get("args", []))
            results.append({"id": test.get("id"), "status": "ok", "json": json.dumps(value)})
        except BaseException as error:  # noqa: BLE001 - Nutzercode darf alles werfen
            results.append(
                {"id": test.get("id"), "status": "error", "error": describe(error)}
            )

    sys.stdout = _real_stdout
    emit({"status": "ok", "results": results})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
