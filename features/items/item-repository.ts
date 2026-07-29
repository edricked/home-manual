import * as Crypto from 'expo-crypto';
import { type SQLiteDatabase } from 'expo-sqlite';

import { itemInputSchema, type ItemInput } from './item-schema';

type ItemRow = {
  id: string;
  home_id: string;
  name: string;
  area_name: string | null;
  category: string | null;
  manufacturer: string | null;
  model_number: string | null;
  serial_number: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  archived_at: string | null;
};

export type Item = {
  id: string;
  homeId: string;
  name: string;
  areaName: string | null;
  category: string | null;
  manufacturer: string | null;
  modelNumber: string | null;
  serialNumber: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
};

const columns = `
  id, home_id, name, area_name, category, manufacturer, model_number,
  serial_number, notes, created_at, updated_at, archived_at
`;

function fromRow(row: ItemRow): Item {
  return {
    id: row.id,
    homeId: row.home_id,
    name: row.name,
    areaName: row.area_name,
    category: row.category,
    manufacturer: row.manufacturer,
    modelNumber: row.model_number,
    serialNumber: row.serial_number,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    archivedAt: row.archived_at,
  };
}

export async function listItems(db: SQLiteDatabase, homeId: string): Promise<Item[]> {
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT ${columns} FROM items
     WHERE home_id = ? AND archived_at IS NULL
     ORDER BY updated_at DESC`,
    homeId,
  );
  return rows.map(fromRow);
}

export async function searchItems(
  db: SQLiteDatabase,
  homeId: string,
  query: string,
): Promise<Item[]> {
  const normalized = query.trim().toLocaleLowerCase();
  if (!normalized) return [];
  const pattern = `%${normalized.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
  const rows = await db.getAllAsync<ItemRow>(
    `SELECT ${columns} FROM items
     WHERE home_id = ?
       AND archived_at IS NULL
       AND (
         lower(name) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(area_name, '')) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(category, '')) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(manufacturer, '')) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(model_number, '')) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(serial_number, '')) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(notes, '')) LIKE ? ESCAPE '\\'
         OR EXISTS (
           SELECT 1 FROM repair_records r
           WHERE r.item_id = items.id
             AND (
               lower(r.title) LIKE ? ESCAPE '\\'
               OR lower(COALESCE(r.contractor, '')) LIKE ? ESCAPE '\\'
               OR lower(COALESCE(r.notes, '')) LIKE ? ESCAPE '\\'
             )
         )
       )
     ORDER BY updated_at DESC`,
    homeId,
    pattern,
    pattern,
    pattern,
    pattern,
    pattern,
    pattern,
    pattern,
    pattern,
    pattern,
    pattern,
  );
  return rows.map(fromRow);
}

export async function getItem(db: SQLiteDatabase, id: string): Promise<Item | null> {
  const row = await db.getFirstAsync<ItemRow>(
    `SELECT ${columns} FROM items WHERE id = ?`,
    id,
  );
  return row ? fromRow(row) : null;
}

export async function createItem(
  db: SQLiteDatabase,
  homeId: string,
  input: ItemInput,
): Promise<Item> {
  const value = itemInputSchema.parse(input);
  const id = Crypto.randomUUID();
  const now = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO items (
      id, home_id, name, area_name, category, manufacturer, model_number,
      serial_number, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    homeId,
    value.name,
    value.areaName,
    value.category,
    value.manufacturer,
    value.modelNumber,
    value.serialNumber,
    value.notes,
    now,
    now,
  );

  const item = await getItem(db, id);
  if (!item) throw new Error('The item was saved but could not be reopened.');
  return item;
}

export async function updateItem(
  db: SQLiteDatabase,
  id: string,
  input: ItemInput,
): Promise<Item> {
  const value = itemInputSchema.parse(input);
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `UPDATE items SET
      name = ?, area_name = ?, category = ?, manufacturer = ?,
      model_number = ?, serial_number = ?, notes = ?, updated_at = ?
     WHERE id = ?`,
    value.name,
    value.areaName,
    value.category,
    value.manufacturer,
    value.modelNumber,
    value.serialNumber,
    value.notes,
    now,
    id,
  );
  if (result.changes !== 1) throw new Error('This item no longer exists.');

  const item = await getItem(db, id);
  if (!item) throw new Error('The item was updated but could not be reopened.');
  return item;
}

export async function archiveItem(db: SQLiteDatabase, id: string): Promise<void> {
  const now = new Date().toISOString();
  const result = await db.runAsync(
    'UPDATE items SET archived_at = ?, updated_at = ? WHERE id = ?',
    now,
    now,
    id,
  );
  if (result.changes !== 1) throw new Error('This item no longer exists.');
}

export async function restoreItem(db: SQLiteDatabase, id: string): Promise<Item> {
  const now = new Date().toISOString();
  const result = await db.runAsync(
    'UPDATE items SET archived_at = NULL, updated_at = ? WHERE id = ?',
    now,
    id,
  );
  if (result.changes !== 1) throw new Error('This item no longer exists.');

  const item = await getItem(db, id);
  if (!item) throw new Error('The item was restored but could not be reopened.');
  return item;
}
