export function ApiUnreachable() {
  return (
    <section className="notice">
      <h1>API nicht erreichbar</h1>
      <p>
        Die Kata-Clash-API antwortet nicht. Starte sie mit <code>pnpm dev:server</code> und lade
        diese Seite neu.
      </p>
    </section>
  );
}
