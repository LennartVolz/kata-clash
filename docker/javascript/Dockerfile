# Sandbox-Image für JavaScript-Katas.
# Build (Kontext ist das docker/-Verzeichnis):
#   docker build -t kata-clash/js:latest -f docker/javascript/Dockerfile docker
#
# Das Harness ist fest eingebacken, damit Nutzercode es nicht austauschen kann.
FROM node:22-alpine

RUN addgroup -g 10001 -S kata \
 && adduser -u 10001 -S -G kata -h /home/kata kata \
 && mkdir -p /work \
 && chown kata:kata /work

COPY harness/javascript/harness.cjs /opt/kata/harness.cjs
RUN chmod 0555 /opt/kata/harness.cjs

WORKDIR /work
USER 10001:10001
