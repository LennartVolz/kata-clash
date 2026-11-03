import { notFound } from 'next/navigation';

import { ApiUnreachable } from '@/components/api-unreachable';
import { ApiError, getKata } from '@/lib/api';

import { KataClient } from './kata-client';

export const dynamic = 'force-dynamic';

export default async function KataPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  let kata;
  try {
    kata = await getKata(slug);
  } catch (error) {
    if (error instanceof ApiError) return <ApiUnreachable />;
    throw error;
  }

  if (!kata) notFound();

  return <KataClient kata={kata} />;
}
