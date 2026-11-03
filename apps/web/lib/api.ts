import type { KataDetail, KataSummary } from '@kata-clash/shared';

const API_URL = process.env.SERVER_URL ?? 'http://127.0.0.1:4000';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export async function getKatas(): Promise<KataSummary[]> {
  const response = await fetch(`${API_URL}/katas`, { cache: 'no-store' });
  if (!response.ok) {
    throw new ApiError(`API antwortet mit ${response.status}`, response.status);
  }
  const body = (await response.json()) as { katas: KataSummary[] };
  return body.katas;
}

/** Liefert `null`, wenn es die Kata nicht gibt; Netzwerkfehler werfen weiter. */
export async function getKata(slug: string): Promise<KataDetail | null> {
  const response = await fetch(`${API_URL}/katas/${encodeURIComponent(slug)}`, {
    cache: 'no-store',
  });
  if (response.status === 404) return null;
  if (!response.ok) {
    throw new ApiError(`API antwortet mit ${response.status}`, response.status);
  }
  return (await response.json()) as KataDetail;
}
