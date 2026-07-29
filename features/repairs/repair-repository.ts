import * as Crypto from 'expo-crypto';
import { type SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

const repairInputSchema = z.object({
  itemId: z.string().min(1),
  title: z.string().trim().min(1, 'Enter what was repaired.').max(120),
  serviceDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.'),
  contractor: z.string().trim().max(120).nullable(),
  cost: z.string().trim().regex(/^$|^\d+(\.\d{1,2})?$/, 'Enter a valid cost.'),
  notes: z.string().trim().max(1500).nullable(),
});

type RepairRow = {
  id: string;
  item_id: string;
  title: string;
  service_date: string;
  contractor: string | null;
  cost_cents: number | null;
  notes: string | null;
  created_at: string;
};

export type RepairRecord = {
  id: string;
  itemId: string;
  title: string;
  serviceDate: string;
  contractor: string | null;
  costCents: number | null;
  notes: string | null;
  createdAt: string;
};

export type RepairInput = z.input<typeof repairInputSchema>;

export async function listRepairs(db: SQLiteDatabase, itemId: string): Promise<RepairRecord[]> {
  const rows = await db.getAllAsync<RepairRow>(
    `SELECT id, item_id, title, service_date, contractor, cost_cents, notes, created_at
     FROM repair_records WHERE item_id = ? ORDER BY service_date DESC, created_at DESC`,
    itemId,
  );
  return rows.map((row) => ({
    id: row.id,
    itemId: row.item_id,
    title: row.title,
    serviceDate: row.service_date,
    contractor: row.contractor,
    costCents: row.cost_cents,
    notes: row.notes,
    createdAt: row.created_at,
  }));
}

export async function createRepair(db: SQLiteDatabase, input: RepairInput) {
  const value = repairInputSchema.parse(input);
  await db.runAsync(
    `INSERT INTO repair_records (
      id, item_id, title, service_date, contractor, cost_cents, notes, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    Crypto.randomUUID(),
    value.itemId,
    value.title,
    value.serviceDate,
    value.contractor || null,
    value.cost ? Math.round(Number(value.cost) * 100) : null,
    value.notes || null,
    new Date().toISOString(),
  );
}

export function formatCost(costCents: number | null) {
  if (costCents === null) return null;
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD' }).format(costCents / 100);
}
