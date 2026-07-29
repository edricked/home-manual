import * as Crypto from 'expo-crypto';
import { type SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

export const essentialCategories = [
  'Utility shutoff',
  'Wi-Fi',
  'Paint',
  'Emergency',
  'Contractor',
  'Household info',
  'Other',
] as const;

export type EssentialCategory = (typeof essentialCategories)[number];

const essentialInputSchema = z.object({
  category: z.enum(essentialCategories),
  title: z.string().trim().min(1, 'Enter a title.').max(100),
  value: z.string().trim().max(300),
  notes: z.string().trim().max(1200),
  isSensitive: z.boolean(),
});

type EssentialRow = {
  id: string;
  home_id: string;
  category: EssentialCategory;
  title: string;
  value: string | null;
  notes: string | null;
  is_sensitive: number;
  created_at: string;
  updated_at: string;
};

export type HomeEssential = {
  id: string;
  homeId: string;
  category: EssentialCategory;
  title: string;
  value: string;
  notes: string;
  isSensitive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type EssentialInput = z.input<typeof essentialInputSchema>;

function fromRow(row: EssentialRow): HomeEssential {
  return {
    id: row.id,
    homeId: row.home_id,
    category: row.category,
    title: row.title,
    value: row.value ?? '',
    notes: row.notes ?? '',
    isSensitive: row.is_sensitive === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function listEssentials(db: SQLiteDatabase, homeId: string) {
  const rows = await db.getAllAsync<EssentialRow>(
    `SELECT * FROM home_essentials
     WHERE home_id = ?
     ORDER BY
       CASE category
         WHEN 'Utility shutoff' THEN 1
         WHEN 'Emergency' THEN 2
         WHEN 'Wi-Fi' THEN 3
         ELSE 4
       END,
       updated_at DESC`,
    homeId,
  );
  return rows.map(fromRow);
}

export async function getEssential(db: SQLiteDatabase, id: string) {
  const row = await db.getFirstAsync<EssentialRow>(
    'SELECT * FROM home_essentials WHERE id = ?',
    id,
  );
  return row ? fromRow(row) : null;
}

export async function saveEssential(
  db: SQLiteDatabase,
  homeId: string,
  input: EssentialInput,
  id?: string,
) {
  const value = essentialInputSchema.parse(input);
  const now = new Date().toISOString();

  if (id) {
    await db.runAsync(
      `UPDATE home_essentials
       SET category = ?, title = ?, value = ?, notes = ?, is_sensitive = ?, updated_at = ?
       WHERE id = ? AND home_id = ?`,
      value.category,
      value.title,
      value.value || null,
      value.notes || null,
      value.isSensitive ? 1 : 0,
      now,
      id,
      homeId,
    );
    return id;
  }

  const newId = Crypto.randomUUID();
  await db.runAsync(
    `INSERT INTO home_essentials (
      id, home_id, category, title, value, notes, is_sensitive, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    newId,
    homeId,
    value.category,
    value.title,
    value.value || null,
    value.notes || null,
    value.isSensitive ? 1 : 0,
    now,
    now,
  );
  return newId;
}

export async function deleteEssential(db: SQLiteDatabase, id: string) {
  await db.runAsync('DELETE FROM home_essentials WHERE id = ?', id);
}
