import * as Crypto from 'expo-crypto';
import { type SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

const homeInputSchema = z.object({
  name: z.string().trim().min(1, 'Enter a name for your home.').max(80),
});

type HomeRow = {
  id: string;
  name: string;
  created_at: string;
  updated_at: string;
};

export type Home = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
};

function fromRow(row: HomeRow): Home {
  return {
    id: row.id,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function getHome(db: SQLiteDatabase): Promise<Home | null> {
  const row = await db.getFirstAsync<HomeRow>(
    'SELECT id, name, created_at, updated_at FROM homes ORDER BY created_at LIMIT 1',
  );
  return row ? fromRow(row) : null;
}

export async function createHome(db: SQLiteDatabase, input: { name: string }): Promise<Home> {
  const values = homeInputSchema.parse(input);
  const existing = await getHome(db);
  if (existing) {
    return existing;
  }

  const id = Crypto.randomUUID();
  const now = new Date().toISOString();
  await db.runAsync(
    'INSERT INTO homes (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
    id,
    values.name,
    now,
    now,
  );

  return { id, name: values.name, createdAt: now, updatedAt: now };
}
