import * as DocumentPicker from 'expo-document-picker';
import { Directory, File, Paths } from 'expo-file-system';
import { type SQLiteDatabase } from 'expo-sqlite';
import * as Sharing from 'expo-sharing';
import { Platform } from 'react-native';
import { z } from 'zod';

const nullableText = z.string().nullable();
const nullableNumber = z.number().nullable();

const homeSchema = z.object({
  id: z.string(),
  name: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

const itemSchema = z.object({
  id: z.string(),
  home_id: z.string(),
  name: z.string(),
  area_name: nullableText,
  category: nullableText,
  manufacturer: nullableText,
  model_number: nullableText,
  serial_number: nullableText,
  notes: nullableText,
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: nullableText,
});

const maintenanceTaskSchema = z.object({
  id: z.string(),
  home_id: z.string(),
  item_id: z.string(),
  title: z.string(),
  interval_days: z.number().int(),
  next_due_date: z.string(),
  notes: nullableText,
  created_at: z.string(),
  updated_at: z.string(),
  archived_at: nullableText,
});

const maintenanceEventSchema = z.object({
  id: z.string(),
  task_id: z.string(),
  completed_at: z.string(),
  notes: nullableText,
});

const documentSchema = z.object({
  id: z.string(),
  item_id: z.string(),
  type: z.string(),
  title: z.string(),
  original_name: z.string(),
  uri: z.string(),
  mime_type: nullableText,
  size_bytes: nullableNumber,
  purchase_date: nullableText,
  warranty_expires: nullableText,
  created_at: z.string(),
});

const repairRecordSchema = z.object({
  id: z.string(),
  item_id: z.string(),
  title: z.string(),
  service_date: z.string(),
  contractor: nullableText,
  cost_cents: nullableNumber,
  notes: nullableText,
  created_at: z.string(),
});

const homeEssentialSchema = z.object({
  id: z.string(),
  home_id: z.string(),
  category: z.string(),
  title: z.string(),
  value: nullableText,
  notes: nullableText,
  is_sensitive: z.number().int(),
  created_at: z.string(),
  updated_at: z.string(),
});

export const backupSchema = z.object({
  format: z.literal('home-manual-backup'),
  version: z.literal(1),
  createdAt: z.string(),
  data: z.object({
    homes: z.array(homeSchema),
    items: z.array(itemSchema),
    maintenanceTasks: z.array(maintenanceTaskSchema),
    maintenanceEvents: z.array(maintenanceEventSchema),
    documents: z.array(documentSchema),
    repairRecords: z.array(repairRecordSchema),
    homeEssentials: z.array(homeEssentialSchema).default([]),
  }),
  files: z.array(z.object({
    documentId: z.string(),
    originalName: z.string(),
    mimeType: nullableText,
    base64: nullableText,
  })),
});

export type HomeManualBackup = z.infer<typeof backupSchema>;

export type BackupSummary = {
  createdAt: string;
  homes: number;
  items: number;
  maintenanceTasks: number;
  documents: number;
  repairRecords: number;
  homeEssentials: number;
  missingAttachments: number;
};

function bytesToBase64(bytes: Uint8Array) {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize));
  }
  return globalThis.btoa(binary);
}

function base64ToBytes(base64: string) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

async function readAttachment(uri: string) {
  try {
    if (Platform.OS === 'web') {
      const response = await fetch(uri);
      if (!response.ok) return null;
      return bytesToBase64(new Uint8Array(await response.arrayBuffer()));
    }
    return await new File(uri).base64();
  } catch {
    return null;
  }
}

export async function createBackup(db: SQLiteDatabase): Promise<HomeManualBackup> {
  const [homes, items, maintenanceTasks, maintenanceEvents, documents, repairRecords, homeEssentials] =
    await Promise.all([
      db.getAllAsync<z.infer<typeof homeSchema>>('SELECT * FROM homes'),
      db.getAllAsync<z.infer<typeof itemSchema>>('SELECT * FROM items'),
      db.getAllAsync<z.infer<typeof maintenanceTaskSchema>>('SELECT * FROM maintenance_tasks'),
      db.getAllAsync<z.infer<typeof maintenanceEventSchema>>('SELECT * FROM maintenance_events'),
      db.getAllAsync<z.infer<typeof documentSchema>>('SELECT * FROM documents'),
      db.getAllAsync<z.infer<typeof repairRecordSchema>>('SELECT * FROM repair_records'),
      db.getAllAsync<z.infer<typeof homeEssentialSchema>>('SELECT * FROM home_essentials'),
    ]);

  const files = await Promise.all(documents.map(async (document) => ({
    documentId: document.id,
    originalName: document.original_name,
    mimeType: document.mime_type,
    base64: await readAttachment(document.uri),
  })));

  return backupSchema.parse({
    format: 'home-manual-backup',
    version: 1,
    createdAt: new Date().toISOString(),
    data: { homes, items, maintenanceTasks, maintenanceEvents, documents, repairRecords, homeEssentials },
    files,
  });
}

function backupFilename(date: Date) {
  return `home-manual-${date.toISOString().slice(0, 10)}.homemanual`;
}

export async function exportBackup(db: SQLiteDatabase) {
  const backup = await createBackup(db);
  const json = JSON.stringify(backup);
  const filename = backupFilename(new Date(backup.createdAt));

  if (Platform.OS === 'web') {
    const url = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  } else {
    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true, intermediates: true });
    file.write(json);
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('The share sheet is not available on this device.');
    }
    await Sharing.shareAsync(file.uri, {
      dialogTitle: 'Save Home Manual backup',
      mimeType: 'application/json',
      UTI: 'public.data',
    });
  }

  return getBackupSummary(backup);
}

export async function chooseBackupFile(): Promise<HomeManualBackup | null> {
  const result = await DocumentPicker.getDocumentAsync({
    copyToCacheDirectory: true,
    type: ['application/json', 'application/octet-stream', 'text/plain'],
  });
  if (result.canceled) return null;

  const asset = result.assets[0];
  if (asset.size && asset.size > 100 * 1024 * 1024) {
    throw new Error('That backup is larger than the 100 MB restore limit.');
  }

  let text: string;
  if (Platform.OS === 'web') {
    const response = await fetch(asset.uri);
    text = await response.text();
  } else {
    text = await new File(asset.uri).text();
  }

  try {
    return backupSchema.parse(JSON.parse(text));
  } catch {
    throw new Error('This is not a valid Home Manual backup.');
  }
}

function safeFilename(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-') || 'attachment';
}

async function restoredDocumentUris(backup: HomeManualBackup) {
  const uris = new Map<string, string>();
  const fileByDocument = new Map(backup.files.map((file) => [file.documentId, file]));

  if (Platform.OS !== 'web') {
    new Directory(Paths.document, 'home-manual-documents').create({
      idempotent: true,
      intermediates: true,
    });
  }

  for (const document of backup.data.documents) {
    const attachment = fileByDocument.get(document.id);
    if (!attachment?.base64) {
      uris.set(document.id, document.uri);
      continue;
    }

    if (Platform.OS === 'web') {
      uris.set(
        document.id,
        `data:${attachment.mimeType ?? 'application/octet-stream'};base64,${attachment.base64}`,
      );
    } else {
      const destination = new File(
        Paths.document,
        'home-manual-documents',
        `${document.id}-${safeFilename(attachment.originalName)}`,
      );
      destination.create({ overwrite: true, intermediates: true });
      destination.write(base64ToBytes(attachment.base64));
      uris.set(document.id, destination.uri);
    }
  }
  return uris;
}

export async function restoreBackup(db: SQLiteDatabase, backup: HomeManualBackup) {
  const value = backupSchema.parse(backup);
  const documentUris = await restoredDocumentUris(value);

  await db.withTransactionAsync(async () => {
    await db.execAsync(`
      DELETE FROM maintenance_events;
      DELETE FROM maintenance_tasks;
      DELETE FROM documents;
      DELETE FROM repair_records;
      DELETE FROM home_essentials;
      DELETE FROM items;
      DELETE FROM homes;
    `);

    for (const row of value.data.homes) {
      await db.runAsync(
        'INSERT INTO homes (id, name, created_at, updated_at) VALUES (?, ?, ?, ?)',
        row.id, row.name, row.created_at, row.updated_at,
      );
    }
    for (const row of value.data.items) {
      await db.runAsync(
        `INSERT INTO items (
          id, home_id, name, area_name, category, manufacturer, model_number,
          serial_number, notes, created_at, updated_at, archived_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.home_id, row.name, row.area_name, row.category, row.manufacturer,
        row.model_number, row.serial_number, row.notes, row.created_at, row.updated_at,
        row.archived_at,
      );
    }
    for (const row of value.data.homeEssentials) {
      await db.runAsync(
        `INSERT INTO home_essentials (
          id, home_id, category, title, value, notes, is_sensitive, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.home_id, row.category, row.title, row.value, row.notes,
        row.is_sensitive, row.created_at, row.updated_at,
      );
    }
    for (const row of value.data.maintenanceTasks) {
      await db.runAsync(
        `INSERT INTO maintenance_tasks (
          id, home_id, item_id, title, interval_days, next_due_date, notes,
          created_at, updated_at, archived_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.home_id, row.item_id, row.title, row.interval_days,
        row.next_due_date, row.notes, row.created_at, row.updated_at, row.archived_at,
      );
    }
    for (const row of value.data.maintenanceEvents) {
      await db.runAsync(
        'INSERT INTO maintenance_events (id, task_id, completed_at, notes) VALUES (?, ?, ?, ?)',
        row.id, row.task_id, row.completed_at, row.notes,
      );
    }
    for (const row of value.data.documents) {
      await db.runAsync(
        `INSERT INTO documents (
          id, item_id, type, title, original_name, uri, mime_type, size_bytes,
          purchase_date, warranty_expires, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.item_id, row.type, row.title, row.original_name,
        documentUris.get(row.id) ?? row.uri, row.mime_type, row.size_bytes,
        row.purchase_date, row.warranty_expires, row.created_at,
      );
    }
    for (const row of value.data.repairRecords) {
      await db.runAsync(
        `INSERT INTO repair_records (
          id, item_id, title, service_date, contractor, cost_cents, notes, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        row.id, row.item_id, row.title, row.service_date, row.contractor,
        row.cost_cents, row.notes, row.created_at,
      );
    }
  });
}

export function getBackupSummary(backup: HomeManualBackup): BackupSummary {
  return {
    createdAt: backup.createdAt,
    homes: backup.data.homes.length,
    items: backup.data.items.length,
    maintenanceTasks: backup.data.maintenanceTasks.length,
    documents: backup.data.documents.length,
    repairRecords: backup.data.repairRecords.length,
    homeEssentials: backup.data.homeEssentials.length,
    missingAttachments: backup.files.filter((file) => file.base64 === null).length,
  };
}
