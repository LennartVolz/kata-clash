import { NextResponse } from 'next/server';

const API_URL = process.env.SERVER_URL ?? 'http://127.0.0.1:4000';

/**
 * Proxy für `POST /runs`. Der Browser spricht nur mit der Next-App; so braucht die
 * API keine CORS-Konfiguration und die API-Adresse bleibt serverseitig.
 */
export async function POST(request: Request) {
  const body = await request.text();

  try {
    const response = await fetch(`${API_URL}/runs`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body,
      cache: 'no-store',
    });
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json(
      { error: `API nicht erreichbar (${API_URL}). Läuft \`pnpm dev:server\`?` },
      { status: 502 },
    );
  }
}
