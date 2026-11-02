# Sandbox-Image für Python-Katas.
# Build (Kontext ist das docker/-Verzeichnis):
#   docker build -t kata-clash/python:latest -f docker/python/Dockerfile docker
#
# Das Harness ist fest eingebacken, damit Nutzercode es nicht austauschen kann.
FROM python:3.13-alpine

RUN addgroup -g 10001 -S kata \
 && adduser -u 10001 -S -G kata -h /home/kata kata \
 && mkdir -p /work \
 && chown kata:kata /work

COPY harness/python/harness.py /opt/kata/harness.py
RUN chmod 0555 /opt/kata/harness.py

# Keine .pyc-Dateien schreiben: das Root-Dateisystem ist read-only.
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /work
USER 10001:10001
