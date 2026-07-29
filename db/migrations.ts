import { type SQLiteDatabase } from 'expo-sqlite';

const DATABASE_VERSION = 8;

export async function migrateDatabase(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');

  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = result?.user_version ?? 0;

  if (currentVersion > DATABASE_VERSION) {
    throw new Error('This database was created by a newer version of Home Manual.');
  }

  if (currentVersion === DATABASE_VERSION) {
    return;
  }

  await db.withTransactionAsync(async () => {
    if (currentVersion < 1) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS homes (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS items (
          id TEXT PRIMARY KEY NOT NULL,
          home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
          name TEXT NOT NULL,
          area_name TEXT,
          category TEXT,
          manufacturer TEXT,
          model_number TEXT,
          serial_number TEXT,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          archived_at TEXT
        );

        CREATE INDEX IF NOT EXISTS items_home_active_idx
          ON items(home_id, archived_at, updated_at DESC);

      `);
    }

    if (currentVersion < 2) {
      await db.execAsync(`
        CREATE INDEX IF NOT EXISTS items_search_idx
          ON items(home_id, name, category, area_name, manufacturer, model_number, serial_number);
      `);
    }

    if (currentVersion < 3) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS maintenance_tasks (
          id TEXT PRIMARY KEY NOT NULL,
          home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
          item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          interval_days INTEGER NOT NULL,
          next_due_date TEXT NOT NULL,
          notes TEXT,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL,
          archived_at TEXT
        );

        CREATE TABLE IF NOT EXISTS maintenance_events (
          id TEXT PRIMARY KEY NOT NULL,
          task_id TEXT NOT NULL REFERENCES maintenance_tasks(id) ON DELETE CASCADE,
          completed_at TEXT NOT NULL,
          notes TEXT
        );

        CREATE INDEX IF NOT EXISTS maintenance_due_idx
          ON maintenance_tasks(home_id, archived_at, next_due_date);

        CREATE INDEX IF NOT EXISTS maintenance_events_task_idx
          ON maintenance_events(task_id, completed_at DESC);
      `);
    }

    if (currentVersion < 4) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS documents (
          id TEXT PRIMARY KEY NOT NULL,
          item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
          type TEXT NOT NULL,
          title TEXT NOT NULL,
          original_name TEXT NOT NULL,
          uri TEXT NOT NULL,
          mime_type TEXT,
          size_bytes INTEGER,
          purchase_date TEXT,
          warranty_expires TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS documents_item_idx
          ON documents(item_id, created_at DESC);
      `);
    }

    if (currentVersion < 5) {
      await db.execAsync(`
        DELETE FROM maintenance_events
        WHERE id NOT IN (
          SELECT MIN(id)
          FROM maintenance_events
          GROUP BY task_id, substr(completed_at, 1, 10)
        );

        CREATE UNIQUE INDEX IF NOT EXISTS maintenance_event_task_day_idx
          ON maintenance_events(task_id, substr(completed_at, 1, 10));
      `);
    }

    if (currentVersion < 6) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS repair_records (
          id TEXT PRIMARY KEY NOT NULL,
          item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          service_date TEXT NOT NULL,
          contractor TEXT,
          cost_cents INTEGER,
          notes TEXT,
          created_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS repair_records_item_idx
          ON repair_records(item_id, service_date DESC);
      `);
    }

    if (currentVersion < 7) {
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS home_essentials (
          id TEXT PRIMARY KEY NOT NULL,
          home_id TEXT NOT NULL REFERENCES homes(id) ON DELETE CASCADE,
          category TEXT NOT NULL,
          title TEXT NOT NULL,
          value TEXT,
          notes TEXT,
          is_sensitive INTEGER NOT NULL DEFAULT 0,
          created_at TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS home_essentials_home_idx
          ON home_essentials(home_id, updated_at DESC);
      `);
    }

    if (currentVersion < 8) {
      await db.execAsync(`
        ALTER TABLE maintenance_tasks ADD COLUMN reminder_enabled INTEGER NOT NULL DEFAULT 0;
        ALTER TABLE maintenance_tasks ADD COLUMN reminder_days_before INTEGER NOT NULL DEFAULT 1;
        ALTER TABLE maintenance_tasks ADD COLUMN notification_id TEXT;
      `);
    }

    await db.execAsync(`PRAGMA user_version = ${DATABASE_VERSION};`);
  });
}
