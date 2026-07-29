import * as Crypto from 'expo-crypto';
import { type SQLiteDatabase } from 'expo-sqlite';
import { z } from 'zod';

const taskInputSchema = z.object({
  homeId: z.string().min(1),
  itemId: z.string().min(1, 'Choose an item.'),
  title: z.string().trim().min(1, 'Enter a task name.').max(120),
  intervalDays: z.number().int().min(1).max(3650),
  nextDueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.'),
  notes: z.string().trim().max(1000).nullable(),
});

type TaskRow = {
  id: string;
  home_id: string;
  item_id: string;
  item_name: string;
  title: string;
  interval_days: number;
  next_due_date: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  last_completed_at: string | null;
  archived_at: string | null;
};

type EventRow = {
  id: string;
  task_id: string;
  task_title: string;
  item_name: string;
  completed_at: string;
  notes: string | null;
};

export type MaintenanceTask = {
  id: string;
  homeId: string;
  itemId: string;
  itemName: string;
  title: string;
  intervalDays: number;
  nextDueDate: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  lastCompletedAt: string | null;
  pausedAt: string | null;
};

export type MaintenanceEvent = {
  id: string;
  taskId: string;
  taskTitle: string;
  itemName: string;
  completedAt: string;
  notes: string | null;
};

export type MaintenanceInput = z.input<typeof taskInputSchema>;

const taskColumns = `
  t.id, t.home_id, t.item_id, i.name AS item_name, t.title, t.interval_days,
  t.next_due_date, t.notes, t.created_at, t.updated_at,
  t.archived_at,
  (SELECT MAX(e.completed_at) FROM maintenance_events e WHERE e.task_id = t.id) AS last_completed_at
`;

function taskFromRow(row: TaskRow): MaintenanceTask {
  return {
    id: row.id,
    homeId: row.home_id,
    itemId: row.item_id,
    itemName: row.item_name,
    title: row.title,
    intervalDays: row.interval_days,
    nextDueDate: row.next_due_date,
    notes: row.notes,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    lastCompletedAt: row.last_completed_at,
    pausedAt: row.archived_at,
  };
}

export async function listPausedMaintenanceTasks(
  db: SQLiteDatabase,
  homeId: string,
): Promise<MaintenanceTask[]> {
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT ${taskColumns}
     FROM maintenance_tasks t
     JOIN items i ON i.id = t.item_id
     WHERE t.home_id = ? AND t.archived_at IS NOT NULL AND i.archived_at IS NULL
     ORDER BY t.updated_at DESC`,
    homeId,
  );
  return rows.map(taskFromRow);
}

export async function getMaintenanceTask(
  db: SQLiteDatabase,
  id: string,
): Promise<MaintenanceTask | null> {
  const row = await db.getFirstAsync<TaskRow>(
    `SELECT ${taskColumns}
     FROM maintenance_tasks t
     JOIN items i ON i.id = t.item_id
     WHERE t.id = ?`,
    id,
  );
  return row ? taskFromRow(row) : null;
}

export async function listMaintenanceTasks(
  db: SQLiteDatabase,
  homeId: string,
): Promise<MaintenanceTask[]> {
  const rows = await db.getAllAsync<TaskRow>(
    `SELECT ${taskColumns}
     FROM maintenance_tasks t
     JOIN items i ON i.id = t.item_id
     WHERE t.home_id = ? AND t.archived_at IS NULL AND i.archived_at IS NULL
     ORDER BY t.next_due_date, t.title`,
    homeId,
  );
  return rows.map(taskFromRow);
}

export async function listMaintenanceEvents(
  db: SQLiteDatabase,
  homeId: string,
  limit = 12,
): Promise<MaintenanceEvent[]> {
  const rows = await db.getAllAsync<EventRow>(
    `SELECT e.id, e.task_id, t.title AS task_title, i.name AS item_name,
            e.completed_at, e.notes
     FROM maintenance_events e
     JOIN maintenance_tasks t ON t.id = e.task_id
     JOIN items i ON i.id = t.item_id
     WHERE t.home_id = ?
     ORDER BY e.completed_at DESC
     LIMIT ?`,
    homeId,
    limit,
  );
  return rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    itemName: row.item_name,
    completedAt: row.completed_at,
    notes: row.notes,
  }));
}

export async function listTaskEvents(
  db: SQLiteDatabase,
  taskId: string,
): Promise<MaintenanceEvent[]> {
  const rows = await db.getAllAsync<EventRow>(
    `SELECT e.id, e.task_id, t.title AS task_title, i.name AS item_name,
            e.completed_at, e.notes
     FROM maintenance_events e
     JOIN maintenance_tasks t ON t.id = e.task_id
     JOIN items i ON i.id = t.item_id
     WHERE e.task_id = ?
     ORDER BY e.completed_at DESC`,
    taskId,
  );
  return rows.map((row) => ({
    id: row.id,
    taskId: row.task_id,
    taskTitle: row.task_title,
    itemName: row.item_name,
    completedAt: row.completed_at,
    notes: row.notes,
  }));
}

export async function createMaintenanceTask(
  db: SQLiteDatabase,
  input: MaintenanceInput,
): Promise<void> {
  const value = taskInputSchema.parse(input);
  const now = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO maintenance_tasks (
      id, home_id, item_id, title, interval_days, next_due_date, notes, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    Crypto.randomUUID(),
    value.homeId,
    value.itemId,
    value.title,
    value.intervalDays,
    value.nextDueDate,
    value.notes,
    now,
    now,
  );
}

export async function updateMaintenanceTask(
  db: SQLiteDatabase,
  id: string,
  input: MaintenanceInput,
): Promise<void> {
  const value = taskInputSchema.parse(input);
  const result = await db.runAsync(
    `UPDATE maintenance_tasks
     SET item_id = ?, title = ?, interval_days = ?, next_due_date = ?, notes = ?, updated_at = ?
     WHERE id = ? AND home_id = ?`,
    value.itemId,
    value.title,
    value.intervalDays,
    value.nextDueDate,
    value.notes,
    new Date().toISOString(),
    id,
    value.homeId,
  );
  if (result.changes !== 1) throw new Error('This maintenance task no longer exists.');
}

export async function setMaintenancePaused(
  db: SQLiteDatabase,
  id: string,
  paused: boolean,
): Promise<void> {
  const now = new Date().toISOString();
  const result = await db.runAsync(
    'UPDATE maintenance_tasks SET archived_at = ?, updated_at = ? WHERE id = ?',
    paused ? now : null,
    now,
    id,
  );
  if (result.changes !== 1) throw new Error('This maintenance task no longer exists.');
}

export async function deleteMaintenanceTask(db: SQLiteDatabase, id: string): Promise<void> {
  const result = await db.runAsync('DELETE FROM maintenance_tasks WHERE id = ?', id);
  if (result.changes !== 1) throw new Error('This maintenance task no longer exists.');
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export async function completeMaintenanceTask(
  db: SQLiteDatabase,
  task: MaintenanceTask,
  notes: string | null = null,
): Promise<void> {
  const now = new Date();
  await db.withTransactionAsync(async () => {
    const eventResult = await db.runAsync(
      'INSERT OR IGNORE INTO maintenance_events (id, task_id, completed_at, notes) VALUES (?, ?, ?, ?)',
      Crypto.randomUUID(),
      task.id,
      now.toISOString(),
      notes?.trim() || null,
    );
    if (eventResult.changes === 0) return;
    await db.runAsync(
      'UPDATE maintenance_tasks SET next_due_date = ?, updated_at = ? WHERE id = ?',
      addDays(now, task.intervalDays),
      now.toISOString(),
      task.id,
    );
  });
}

export async function undoMaintenanceEvent(
  db: SQLiteDatabase,
  task: MaintenanceTask,
  event: MaintenanceEvent,
): Promise<void> {
  await db.withTransactionAsync(async () => {
    const latest = await db.getFirstAsync<{ id: string }>(
      'SELECT id FROM maintenance_events WHERE task_id = ? ORDER BY completed_at DESC LIMIT 1',
      task.id,
    );
    if (latest?.id !== event.id) {
      throw new Error('Only the most recent completion can be undone.');
    }

    await db.runAsync('DELETE FROM maintenance_events WHERE id = ? AND task_id = ?', event.id, task.id);
    const previous = await db.getFirstAsync<{ completed_at: string }>(
      'SELECT completed_at FROM maintenance_events WHERE task_id = ? ORDER BY completed_at DESC LIMIT 1',
      task.id,
    );

    let nextDueDate: string;
    if (previous) {
      nextDueDate = addDays(new Date(previous.completed_at), task.intervalDays);
    } else {
      const currentDue = new Date(`${task.nextDueDate}T00:00:00`);
      currentDue.setDate(currentDue.getDate() - task.intervalDays);
      nextDueDate = currentDue.toISOString().slice(0, 10);
    }
    await db.runAsync(
      'UPDATE maintenance_tasks SET next_due_date = ?, updated_at = ? WHERE id = ?',
      nextDueDate,
      new Date().toISOString(),
      task.id,
    );
  });
}

export function getDueState(nextDueDate: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(`${nextDueDate}T00:00:00`);
  const days = Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { key: 'overdue' as const, label: `${Math.abs(days)}d overdue` };
  if (days === 0) return { key: 'due' as const, label: 'Due today' };
  if (days <= 14) return { key: 'soon' as const, label: `Due in ${days}d` };
  return { key: 'upcoming' as const, label: `Due ${formatDate(nextDueDate)}` };
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
    .format(new Date(`${value.slice(0, 10)}T00:00:00`));
}
