import * as Crypto from 'expo-crypto';
import { Directory, File, Paths } from 'expo-file-system';
import { type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import { z } from 'zod';

export const documentTypes = ['Receipt', 'Warranty', 'Manual', 'Photo', 'Other'] as const;
export type DocumentType = (typeof documentTypes)[number];

const documentInputSchema = z.object({
  itemId: z.string().min(1),
  type: z.enum(documentTypes),
  title: z.string().trim().min(1, 'Enter a title.').max(120),
  originalName: z.string().min(1),
  sourceUri: z.string().min(1),
  mimeType: z.string().nullable(),
  sizeBytes: z.number().nullable(),
  purchaseDate: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').nullable(),
  warrantyExpires: z.string().regex(/^$|^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD.').nullable(),
});

type DocumentRow = {
  id: string;
  item_id: string;
  type: DocumentType;
  title: string;
  original_name: string;
  uri: string;
  mime_type: string | null;
  size_bytes: number | null;
  purchase_date: string | null;
  warranty_expires: string | null;
  created_at: string;
};

export type HomeDocument = {
  id: string;
  itemId: string;
  type: DocumentType;
  title: string;
  originalName: string;
  uri: string;
  mimeType: string | null;
  sizeBytes: number | null;
  purchaseDate: string | null;
  warrantyExpires: string | null;
  createdAt: string;
};

type DocumentWithItemRow = DocumentRow & {
  item_name: string;
  area_name: string | null;
};

export type DocumentWithItem = HomeDocument & {
  itemName: string;
  areaName: string | null;
};

export type DocumentInput = z.input<typeof documentInputSchema>;

function fromRow(row: DocumentRow): HomeDocument {
  return {
    id: row.id,
    itemId: row.item_id,
    type: row.type,
    title: row.title,
    originalName: row.original_name,
    uri: row.uri,
    mimeType: row.mime_type,
    sizeBytes: row.size_bytes,
    purchaseDate: row.purchase_date,
    warrantyExpires: row.warranty_expires,
    createdAt: row.created_at,
  };
}

export async function listDocuments(db: SQLiteDatabase, itemId: string): Promise<HomeDocument[]> {
  const rows = await db.getAllAsync<DocumentRow>(
    `SELECT id, item_id, type, title, original_name, uri, mime_type, size_bytes,
            purchase_date, warranty_expires, created_at
     FROM documents WHERE item_id = ? ORDER BY created_at DESC`,
    itemId,
  );
  return rows.map(fromRow);
}

export async function listHomeDocuments(
  db: SQLiteDatabase,
  homeId: string,
): Promise<DocumentWithItem[]> {
  const rows = await db.getAllAsync<DocumentWithItemRow>(
    `SELECT d.id, d.item_id, d.type, d.title, d.original_name, d.uri, d.mime_type,
            d.size_bytes, d.purchase_date, d.warranty_expires, d.created_at,
            i.name AS item_name, i.area_name
     FROM documents d
     JOIN items i ON i.id = d.item_id
     WHERE i.home_id = ? AND i.archived_at IS NULL
     ORDER BY
       CASE
         WHEN d.warranty_expires IS NOT NULL AND d.warranty_expires >= date('now')
           THEN d.warranty_expires
         ELSE '9999-12-31'
       END,
       d.created_at DESC`,
    homeId,
  );
  return rows.map((row) => ({
    ...fromRow(row),
    itemName: row.item_name,
    areaName: row.area_name,
  }));
}

export function getWarrantyState(warrantyExpires: string | null) {
  if (!warrantyExpires) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(`${warrantyExpires}T00:00:00`);
  const days = Math.ceil((expiry.getTime() - today.getTime()) / 86_400_000);
  if (days < 0) return { key: 'expired' as const, label: `Expired ${Math.abs(days)}d ago`, days };
  if (days === 0) return { key: 'soon' as const, label: 'Expires today', days };
  if (days <= 60) return { key: 'soon' as const, label: `Expires in ${days}d`, days };
  return { key: 'active' as const, label: `Expires ${warrantyExpires}`, days };
}

function safeFilename(name: string) {
  const cleaned = name.replace(/[^a-zA-Z0-9._-]/g, '-').replace(/-+/g, '-');
  return cleaned || 'attachment';
}

function persistFile(id: string, sourceUri: string, originalName: string) {
  if (Platform.OS === 'web') return sourceUri;
  const directory = new Directory(Paths.document, 'home-manual-documents');
  directory.create({ idempotent: true, intermediates: true });
  const destination = new File(directory, `${id}-${safeFilename(originalName)}`);
  new File(sourceUri).copy(destination);
  return destination.uri;
}

export async function createDocument(db: SQLiteDatabase, input: DocumentInput): Promise<void> {
  const value = documentInputSchema.parse(input);
  const id = Crypto.randomUUID();
  const uri = persistFile(id, value.sourceUri, value.originalName);
  await db.runAsync(
    `INSERT INTO documents (
      id, item_id, type, title, original_name, uri, mime_type, size_bytes,
      purchase_date, warranty_expires, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    id,
    value.itemId,
    value.type,
    value.title,
    value.originalName,
    uri,
    value.mimeType,
    value.sizeBytes,
    value.purchaseDate || null,
    value.warrantyExpires || null,
    new Date().toISOString(),
  );
}

export async function deleteDocument(db: SQLiteDatabase, document: HomeDocument) {
  if (Platform.OS !== 'web') {
    const file = new File(document.uri);
    if (file.exists) file.delete();
  }
  await db.runAsync('DELETE FROM documents WHERE id = ?', document.id);
}

export function formatFileSize(bytes: number | null) {
  if (!bytes) return null;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
