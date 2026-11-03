import { EmailTakenError, createUser } from '@kata-clash/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name braucht mindestens 2 Zeichen').max(50),
  email: z.email('Ungültige E-Mail-Adresse'),
  password: z.string().min(8, 'Passwort braucht mindestens 8 Zeichen').max(200),
});

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Bitte Eingaben prüfen',
        issues: parsed.error.issues.map((issue) => issue.message),
      },
      { status: 400 },
    );
  }

  try {
    const user = await createUser(parsed.data);
    return NextResponse.json({ id: user.id }, { status: 201 });
  } catch (error) {
    if (error instanceof EmailTakenError) {
      return NextResponse.json({ error: error.message }, { status: 409 });
    }
    console.error('Registrierung fehlgeschlagen:', error);
    return NextResponse.json(
      { error: 'Registrierung fehlgeschlagen. Ist die Datenbank erreichbar?' },
      { status: 500 },
    );
  }
}
