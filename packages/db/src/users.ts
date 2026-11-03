import { prisma } from './client';
import { hashPassword } from './password';

export class EmailTakenError extends Error {
  constructor() {
    super('Diese E-Mail-Adresse ist bereits registriert');
    this.name = 'EmailTakenError';
  }
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export interface CreateUserInput {
  email: string;
  name: string;
  password: string;
}

/** Legt einen Nutzer mit Passwort an; bei doppelter E-Mail `EmailTakenError`. */
export async function createUser(input: CreateUserInput) {
  const passwordHash = await hashPassword(input.password);
  try {
    return await prisma.user.create({
      data: {
        email: normalizeEmail(input.email),
        name: input.name.trim(),
        passwordHash,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) throw new EmailTakenError();
    throw error;
  }
}

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email: normalizeEmail(email) } });
}

export function findUserById(id: string) {
  return prisma.user.findUnique({ where: { id } });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'P2002'
  );
}
