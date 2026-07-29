import { type SQLiteDatabase } from 'expo-sqlite';

export type SearchResultKind =
  | 'item'
  | 'essential'
  | 'maintenance'
  | 'history'
  | 'repair'
  | 'document';

export type SearchResult = {
  id: string;
  kind: SearchResultKind;
  itemId: string | null;
  title: string;
  subtitle: string;
  isSensitive: boolean;
};

type SearchRow = {
  id: string;
  item_id: string | null;
  title: string;
  subtitle: string | null;
  is_sensitive?: number;
};

function patternFor(query: string) {
  const normalized = query.trim().toLocaleLowerCase();
  return `%${normalized.replaceAll('\\', '\\\\').replaceAll('%', '\\%').replaceAll('_', '\\_')}%`;
}

function result(kind: SearchResultKind, row: SearchRow): SearchResult {
  return {
    id: row.id,
    kind,
    itemId: row.item_id,
    title: row.title,
    subtitle: row.subtitle ?? '',
    isSensitive: row.is_sensitive === 1,
  };
}

export async function searchHomeManual(
  db: SQLiteDatabase,
  homeId: string,
  query: string,
): Promise<SearchResult[]> {
  if (!query.trim()) return [];
  const pattern = patternFor(query);

  const [items, essentials, maintenance, history, repairs, documents] = await Promise.all([
    db.getAllAsync<SearchRow>(
      `SELECT id, id AS item_id, name AS title,
              trim(COALESCE(category, '') || ' · ' || COALESCE(area_name, '') || ' · ' ||
                   COALESCE(manufacturer, '') || ' ' || COALESCE(model_number, '')) AS subtitle
       FROM items
       WHERE home_id = ? AND archived_at IS NULL AND (
         lower(name) LIKE ? ESCAPE '\\' OR lower(COALESCE(area_name, '')) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(category, '')) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(manufacturer, '')) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(model_number, '')) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(serial_number, '')) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(notes, '')) LIKE ? ESCAPE '\\'
       )
       ORDER BY updated_at DESC LIMIT 30`,
      homeId, pattern, pattern, pattern, pattern, pattern, pattern, pattern,
    ),
    db.getAllAsync<SearchRow>(
      `SELECT id, NULL AS item_id, title,
              CASE WHEN is_sensitive = 1 THEN category || ' · Hidden value'
                   ELSE trim(category || ' · ' || COALESCE(value, '')) END AS subtitle,
              is_sensitive
       FROM home_essentials
       WHERE home_id = ? AND (
         lower(title) LIKE ? ESCAPE '\\' OR lower(category) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(value, '')) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(notes, '')) LIKE ? ESCAPE '\\'
       )
       ORDER BY updated_at DESC LIMIT 30`,
      homeId, pattern, pattern, pattern, pattern,
    ),
    db.getAllAsync<SearchRow>(
      `SELECT t.id, t.item_id, t.title,
              i.name || ' · Due ' || t.next_due_date AS subtitle
       FROM maintenance_tasks t
       JOIN items i ON i.id = t.item_id
       WHERE t.home_id = ? AND t.archived_at IS NULL AND i.archived_at IS NULL AND (
         lower(t.title) LIKE ? ESCAPE '\\' OR lower(COALESCE(t.notes, '')) LIKE ? ESCAPE '\\'
         OR lower(i.name) LIKE ? ESCAPE '\\' OR lower(t.next_due_date) LIKE ? ESCAPE '\\'
       )
       ORDER BY t.next_due_date LIMIT 30`,
      homeId, pattern, pattern, pattern, pattern,
    ),
    db.getAllAsync<SearchRow>(
      `SELECT e.id, t.item_id, t.title,
              i.name || ' · Completed ' || substr(e.completed_at, 1, 10) AS subtitle
       FROM maintenance_events e
       JOIN maintenance_tasks t ON t.id = e.task_id
       JOIN items i ON i.id = t.item_id
       WHERE t.home_id = ? AND (
         lower(t.title) LIKE ? ESCAPE '\\' OR lower(i.name) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(e.notes, '')) LIKE ? ESCAPE '\\'
         OR lower(e.completed_at) LIKE ? ESCAPE '\\'
       )
       ORDER BY e.completed_at DESC LIMIT 30`,
      homeId, pattern, pattern, pattern, pattern,
    ),
    db.getAllAsync<SearchRow>(
      `SELECT r.id, r.item_id, r.title,
              i.name || ' · ' || r.service_date ||
              CASE WHEN r.contractor IS NULL OR r.contractor = '' THEN '' ELSE ' · ' || r.contractor END AS subtitle
       FROM repair_records r
       JOIN items i ON i.id = r.item_id
       WHERE i.home_id = ? AND i.archived_at IS NULL AND (
         lower(r.title) LIKE ? ESCAPE '\\' OR lower(i.name) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(r.contractor, '')) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(r.notes, '')) LIKE ? ESCAPE '\\'
         OR lower(r.service_date) LIKE ? ESCAPE '\\'
       )
       ORDER BY r.service_date DESC LIMIT 30`,
      homeId, pattern, pattern, pattern, pattern, pattern,
    ),
    db.getAllAsync<SearchRow>(
      `SELECT d.id, d.item_id, d.title,
              i.name || ' · ' || d.type || ' · ' || d.original_name AS subtitle
       FROM documents d
       JOIN items i ON i.id = d.item_id
       WHERE i.home_id = ? AND i.archived_at IS NULL AND (
         lower(d.title) LIKE ? ESCAPE '\\' OR lower(d.original_name) LIKE ? ESCAPE '\\'
         OR lower(d.type) LIKE ? ESCAPE '\\' OR lower(i.name) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(d.purchase_date, '')) LIKE ? ESCAPE '\\'
         OR lower(COALESCE(d.warranty_expires, '')) LIKE ? ESCAPE '\\'
       )
       ORDER BY d.created_at DESC LIMIT 30`,
      homeId, pattern, pattern, pattern, pattern, pattern, pattern,
    ),
  ]);

  return [
    ...items.map((row) => result('item', row)),
    ...essentials.map((row) => result('essential', row)),
    ...maintenance.map((row) => result('maintenance', row)),
    ...history.map((row) => result('history', row)),
    ...repairs.map((row) => result('repair', row)),
    ...documents.map((row) => result('document', row)),
  ];
}
