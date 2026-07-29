import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Linking, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  deleteDocument,
  formatFileSize,
  listDocuments,
  type HomeDocument,
} from '@/features/documents/document-repository';
import { ItemForm } from '@/features/items/item-form';
import { archiveItem, getItem, restoreItem, type Item, updateItem } from '@/features/items/item-repository';
import { type ItemInput } from '@/features/items/item-schema';
import { formatCost, listRepairs, type RepairRecord } from '@/features/repairs/repair-repository';

export default function ItemDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const [item, setItem] = useState<Item | null>();
  const [documents, setDocuments] = useState<HomeDocument[]>([]);
  const [repairs, setRepairs] = useState<RepairRecord[]>([]);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    if (!id) return;
    try {
      const [itemRow, documentRows, repairRows] = await Promise.all([
        getItem(db, id),
        listDocuments(db, id),
        listRepairs(db, id),
      ]);
      setItem(itemRow);
      setDocuments(documentRows);
      setRepairs(repairRows);
    } catch {
      setError('Could not load this item.');
    }
  }, [db, id]);

  useFocusEffect(useCallback(() => void load(), [load]));

  async function submit(input: ItemInput) {
    if (!id) return;
    setError(undefined);
    try {
      setItem(await updateItem(db, id, input));
      Alert.alert('Saved', 'The item was updated on this phone.');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not update the item.');
      throw caught;
    }
  }

  async function toggleArchive() {
    if (!item) return;
    if (item.archivedAt) {
      setItem(await restoreItem(db, item.id));
    } else {
      await archiveItem(db, item.id);
      router.replace('/items');
    }
  }

  async function removeDocument(document: HomeDocument) {
    await deleteDocument(db, document);
    setDocuments((current) => current.filter((row) => row.id !== document.id));
  }

  if (item === undefined) return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  if (error || item === null) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error ?? 'This item could not be found.'}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ItemForm
        error={error}
        footer={
          <View style={styles.detailSections}>
          <View style={styles.documentsSection}>
            <View style={styles.documentsHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>DOCUMENTS</Text>
                <Text style={styles.sectionTitle}>Manuals, receipts & more</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/documents/new?itemId=${item.id}` as never)}
                style={styles.addDocumentButton}>
                <Text style={styles.addDocumentText}>+ Add</Text>
              </Pressable>
            </View>

            {documents.length === 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/documents/new?itemId=${item.id}` as never)}
                style={styles.documentEmpty}>
                <View style={styles.documentIcon}><Text style={styles.documentIconText}>+</Text></View>
                <View style={styles.documentText}>
                  <Text style={styles.documentTitle}>Keep the paperwork here</Text>
                  <Text style={styles.documentMeta}>Add a manual, receipt, warranty, or photo.</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ) : (
              <View style={styles.documentList}>
                {documents.map((document, index) => (
                  <View key={document.id} style={[styles.documentRow, index < documents.length - 1 && styles.documentBorder]}>
                    <View style={styles.documentBadge}><Text style={styles.documentBadgeText}>{document.type.slice(0, 1)}</Text></View>
                    <Pressable accessibilityRole="button" onPress={() => Linking.openURL(document.uri)} style={styles.documentText}>
                      <Text style={styles.documentTitle}>{document.title}</Text>
                      <Text style={styles.documentMeta}>
                        {[document.type, formatFileSize(document.sizeBytes), document.warrantyExpires ? `Warranty to ${document.warrantyExpires}` : null]
                          .filter(Boolean)
                          .join(' · ')}
                      </Text>
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`Remove ${document.title}`}
                      accessibilityRole="button"
                      onPress={() => removeDocument(document)}
                      style={styles.removeButton}>
                      <Text style={styles.removeText}>×</Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            )}
          </View>
          <View style={styles.documentsSection}>
            <View style={styles.documentsHeader}>
              <View>
                <Text style={styles.sectionEyebrow}>SERVICE HISTORY</Text>
                <Text style={styles.sectionTitle}>Repairs & professional help</Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/repairs/new?itemId=${item.id}` as never)}
                style={styles.addDocumentButton}>
                <Text style={styles.addDocumentText}>+ Add</Text>
              </Pressable>
            </View>
            {repairs.length === 0 ? (
              <Pressable
                accessibilityRole="button"
                onPress={() => router.push(`/repairs/new?itemId=${item.id}` as never)}
                style={styles.documentEmpty}>
                <View style={styles.documentIcon}><Text style={styles.documentIconText}>+</Text></View>
                <View style={styles.documentText}>
                  <Text style={styles.documentTitle}>No repairs recorded</Text>
                  <Text style={styles.documentMeta}>Keep costs, contractors, and work notes together.</Text>
                </View>
                <Text style={styles.chevron}>›</Text>
              </Pressable>
            ) : (
              <>
                <View style={styles.repairSummary}>
                  <Text style={styles.repairSummaryLabel}>TOTAL RECORDED COST</Text>
                  <Text style={styles.repairSummaryValue}>
                    {formatCost(repairs.reduce((sum, repair) => sum + (repair.costCents ?? 0), 0))}
                  </Text>
                </View>
                <View style={styles.documentList}>
                  {repairs.map((repair, index) => (
                    <View key={repair.id} style={[styles.documentRow, index < repairs.length - 1 && styles.documentBorder]}>
                      <View style={styles.repairDate}>
                        <Text style={styles.repairMonth}>
                          {new Date(`${repair.serviceDate}T00:00:00`).toLocaleDateString(undefined, { month: 'short' })}
                        </Text>
                        <Text style={styles.repairDay}>{repair.serviceDate.slice(-2)}</Text>
                      </View>
                      <View style={styles.documentText}>
                        <Text style={styles.documentTitle}>{repair.title}</Text>
                        <Text style={styles.documentMeta}>
                          {[repair.contractor, formatCost(repair.costCents)].filter(Boolean).join(' · ') || 'No contractor or cost'}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              </>
            )}
          </View>
          </View>
        }
        initialValue={item}
        onSubmit={submit}
        submitLabel="Save changes"
      />
      <Pressable accessibilityRole="button" onPress={toggleArchive} style={styles.archiveButton}>
        <Text style={styles.archiveText}>{item.archivedAt ? 'Restore item' : 'Archive item'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  archiveButton: { alignItems: 'center', minHeight: 48, justifyContent: 'center', padding: 12 },
  archiveText: { color: '#8f2d21', fontWeight: '600' },
  addDocumentButton: { backgroundColor: '#e5f0ea', borderRadius: 10, paddingHorizontal: 13, paddingVertical: 9 },
  addDocumentText: { color: '#2f6651', fontWeight: '800' },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center', padding: 24 },
  chevron: { color: '#78827e', fontSize: 26 },
  container: { flex: 1 },
  documentBadge: { alignItems: 'center', backgroundColor: '#e5f0ea', borderRadius: 18, height: 36, justifyContent: 'center', width: 36 },
  documentBadgeText: { color: '#2f6651', fontSize: 14, fontWeight: '800' },
  documentBorder: { borderBottomColor: '#e8eae7', borderBottomWidth: 1 },
  documentEmpty: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#e0e3df', borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 78, padding: 14 },
  documentIcon: { alignItems: 'center', backgroundColor: '#e5f0ea', borderRadius: 20, height: 40, justifyContent: 'center', width: 40 },
  documentIconText: { color: '#2f6651', fontSize: 22, fontWeight: '700' },
  documentList: { backgroundColor: '#fff', borderRadius: 15, paddingHorizontal: 14 },
  documentMeta: { color: '#76807c', fontSize: 12, marginTop: 3 },
  documentRow: { alignItems: 'center', flexDirection: 'row', gap: 11, minHeight: 72, paddingVertical: 11 },
  documentsHeader: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between' },
  documentsSection: { gap: 11, marginTop: 8 },
  documentText: { flex: 1 },
  documentTitle: { color: '#2b3833', fontSize: 15, fontWeight: '700' },
  detailSections: { gap: 28 },
  error: { color: '#b42318', textAlign: 'center' },
  removeButton: { alignItems: 'center', height: 36, justifyContent: 'center', width: 36 },
  removeText: { color: '#8f4b43', fontSize: 22 },
  repairDate: { alignItems: 'center', backgroundColor: '#eef2ef', borderRadius: 10, height: 44, justifyContent: 'center', width: 44 },
  repairDay: { color: '#263b33', fontSize: 16, fontWeight: '800', lineHeight: 17 },
  repairMonth: { color: '#66756e', fontSize: 9, fontWeight: '800', textTransform: 'uppercase' },
  repairSummary: { backgroundColor: '#263b33', borderRadius: 14, padding: 16 },
  repairSummaryLabel: { color: '#bdcbc5', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  repairSummaryValue: { color: '#fff', fontSize: 23, fontWeight: '800', marginTop: 3 },
  sectionEyebrow: { color: '#2f6651', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  sectionTitle: { color: '#26332f', fontSize: 18, fontWeight: '800', marginTop: 3 },
});
