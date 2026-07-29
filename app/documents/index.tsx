import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppFrame } from '@/components/app-frame';
import {
  documentTypes,
  formatFileSize,
  getWarrantyState,
  listHomeDocuments,
  type DocumentType,
  type DocumentWithItem,
} from '@/features/documents/document-repository';
import { getHome } from '@/features/home/home-repository';

type Filter = 'All' | DocumentType;
const filters: Filter[] = ['All', ...documentTypes];

const typeIcons: Record<DocumentType, keyof typeof Ionicons.glyphMap> = {
  Receipt: 'receipt-outline',
  Warranty: 'shield-checkmark-outline',
  Manual: 'book-outline',
  Photo: 'image-outline',
  Other: 'document-outline',
};

export default function DocumentsScreen() {
  const db = useSQLiteContext();
  const [documents, setDocuments] = useState<DocumentWithItem[]>([]);
  const [filter, setFilter] = useState<Filter>('All');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const home = await getHome(db);
      if (!home) {
        router.replace('/onboarding');
        return;
      }
      setDocuments(await listHomeDocuments(db, home.id));
    } catch {
      setError('Could not load your documents.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => void load(), [load]));

  const visibleDocuments = useMemo(() => {
    const term = query.trim().toLocaleLowerCase();
    return documents.filter((document) => {
      if (filter !== 'All' && document.type !== filter) return false;
      if (!term) return true;
      return [
        document.title,
        document.originalName,
        document.itemName,
        document.areaName,
        document.type,
      ].some((value) => value?.toLocaleLowerCase().includes(term));
    });
  }, [documents, filter, query]);

  const warrantyCount = documents.filter((document) => {
    const state = getWarrantyState(document.warrantyExpires);
    return state?.key === 'soon';
  }).length;

  return (
    <AppFrame>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>PAPERWORK, ORGANIZED</Text>
            <Text style={styles.title}>Documents</Text>
            <Text style={styles.subtitle}>{documents.length} file{documents.length === 1 ? '' : 's'} saved locally</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/documents/new')} style={styles.addButton}>
            <Ionicons color="#fff" name="add" size={19} />
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        </View>

        {warrantyCount > 0 ? (
          <View style={styles.warrantyBanner}>
            <View style={styles.warrantyIcon}><Ionicons color="#8a5a15" name="time-outline" size={21} /></View>
            <View style={styles.flex}>
              <Text style={styles.warrantyTitle}>Warranty check</Text>
              <Text style={styles.warrantyBody}>
                {warrantyCount} warrant{warrantyCount === 1 ? 'y expires' : 'ies expire'} within 60 days.
              </Text>
            </View>
          </View>
        ) : null}

        <View style={styles.searchBox}>
          <Ionicons color="#68766f" name="search" size={20} />
          <TextInput
            accessibilityLabel="Search documents"
            autoCapitalize="none"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Filename, item, room…"
            placeholderTextColor="#89938e"
            style={styles.searchInput}
            value={query}
          />
          {query ? (
            <Pressable accessibilityLabel="Clear document search" accessibilityRole="button" onPress={() => setQuery('')}>
              <Ionicons color="#68766f" name="close-circle" size={20} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={styles.filters}
          horizontal
          showsHorizontalScrollIndicator={false}>
          {filters.map((option) => (
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ selected: filter === option }}
              key={option}
              onPress={() => setFilter(option)}
              style={[styles.filter, filter === option && styles.selectedFilter]}>
              <Text style={[styles.filterText, filter === option && styles.selectedFilterText]}>{option}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {loading ? <ActivityIndicator color="#2f6651" style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && !error && visibleDocuments.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}><Ionicons color="#2f6651" name="documents-outline" size={29} /></View>
            <Text style={styles.emptyTitle}>{documents.length ? 'No matching documents' : 'Keep the paperwork here'}</Text>
            <Text style={styles.emptyBody}>
              {documents.length
                ? 'Try another filename, item, room, or document type.'
                : 'Add manuals, receipts, warranties, and photos to the item they belong to.'}
            </Text>
            {!documents.length ? (
              <Pressable accessibilityRole="button" onPress={() => router.push('/documents/new')} style={styles.emptyButton}>
                <Text style={styles.emptyButtonText}>Add first document</Text>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View style={styles.list}>
            {visibleDocuments.map((document) => {
              const warranty = getWarrantyState(document.warrantyExpires);
              return (
                <View key={document.id} style={styles.documentCard}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => Linking.openURL(document.uri)}
                    style={({ pressed }) => [styles.documentMain, pressed && styles.pressed]}>
                    <View style={styles.typeIcon}>
                      <Ionicons color="#2f6651" name={typeIcons[document.type]} size={22} />
                    </View>
                    <View style={styles.flex}>
                      <Text style={styles.documentTitle}>{document.title}</Text>
                      <Text numberOfLines={1} style={styles.documentMeta}>
                        {[document.type, formatFileSize(document.sizeBytes), document.originalName].filter(Boolean).join(' · ')}
                      </Text>
                    </View>
                    <Ionicons color="#7f8c86" name="open-outline" size={19} />
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => router.push({ pathname: '/items/[id]', params: { id: document.itemId } })}
                    style={({ pressed }) => [styles.itemLink, pressed && styles.pressed]}>
                    <Ionicons color="#63736b" name="cube-outline" size={15} />
                    <Text numberOfLines={1} style={styles.itemName}>
                      {document.itemName}{document.areaName ? ` · ${document.areaName}` : ''}
                    </Text>
                    {warranty ? (
                      <View style={[styles.warrantyPill, warranty.key === 'soon' && styles.warrantySoon, warranty.key === 'expired' && styles.warrantyExpired]}>
                        <Text style={[styles.warrantyPillText, warranty.key === 'soon' && styles.warrantySoonText, warranty.key === 'expired' && styles.warrantyExpiredText]}>
                          {warranty.label}
                        </Text>
                      </View>
                    ) : null}
                    <Ionicons color="#839089" name="chevron-forward" size={16} />
                  </Pressable>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  addButton: { alignItems: 'center', backgroundColor: '#263b33', borderRadius: 12, flexDirection: 'row', gap: 5, paddingHorizontal: 13, paddingVertical: 10 },
  addText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 40 },
  documentCard: { backgroundColor: '#fff', borderColor: '#dfe4e1', borderRadius: 16, borderWidth: 1, overflow: 'hidden' },
  documentMain: { alignItems: 'center', flexDirection: 'row', gap: 11, minHeight: 75, padding: 14 },
  documentMeta: { color: '#75807b', fontSize: 12, marginTop: 4 },
  documentTitle: { color: '#27342f', fontSize: 16, fontWeight: '800' },
  empty: { alignItems: 'center', gap: 9, paddingHorizontal: 24, paddingTop: 45 },
  emptyBody: { color: '#68736f', fontSize: 14, lineHeight: 21, maxWidth: 350, textAlign: 'center' },
  emptyButton: { backgroundColor: '#263b33', borderRadius: 12, marginTop: 6, paddingHorizontal: 17, paddingVertical: 12 },
  emptyButtonText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  emptyIcon: { alignItems: 'center', backgroundColor: '#e5f0ea', borderRadius: 28, height: 56, justifyContent: 'center', width: 56 },
  emptyTitle: { color: '#27342f', fontSize: 20, fontWeight: '800' },
  error: { color: '#9b352f', marginTop: 30, textAlign: 'center' },
  eyebrow: { color: '#2f6651', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  filter: { backgroundColor: '#fff', borderColor: '#d6ddd9', borderRadius: 18, borderWidth: 1, paddingHorizontal: 13, paddingVertical: 8 },
  filters: { gap: 8, paddingVertical: 14 },
  filterText: { color: '#5c6863', fontSize: 13, fontWeight: '700' },
  flex: { flex: 1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 17 },
  headerCopy: { flex: 1 },
  itemLink: { alignItems: 'center', backgroundColor: '#f5f6f3', borderTopColor: '#e7eae8', borderTopWidth: 1, flexDirection: 'row', gap: 7, minHeight: 43, paddingHorizontal: 14 },
  itemName: { color: '#586760', flex: 1, fontSize: 12, fontWeight: '700' },
  list: { gap: 11 },
  loader: { marginTop: 35 },
  pressed: { opacity: 0.68 },
  searchBox: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#c3cdc8', borderRadius: 13, borderWidth: 1, flexDirection: 'row', gap: 8, minHeight: 49, paddingHorizontal: 13 },
  searchInput: { color: '#26332f', flex: 1, fontSize: 15, paddingVertical: 10 },
  selectedFilter: { backgroundColor: '#2f6651', borderColor: '#2f6651' },
  selectedFilterText: { color: '#fff' },
  subtitle: { color: '#68736f', fontSize: 13, marginTop: 4 },
  title: { color: '#1f2c28', fontSize: 29, fontWeight: '800', marginTop: 3 },
  typeIcon: { alignItems: 'center', backgroundColor: '#e5f0ea', borderRadius: 12, height: 44, justifyContent: 'center', width: 44 },
  warrantyBanner: { alignItems: 'center', backgroundColor: '#fbf0da', borderRadius: 15, flexDirection: 'row', gap: 11, marginBottom: 14, padding: 13 },
  warrantyBody: { color: '#7b653f', fontSize: 12, marginTop: 2 },
  warrantyExpired: { backgroundColor: '#f7e5e2' },
  warrantyExpiredText: { color: '#8b3d35' },
  warrantyIcon: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 19, height: 38, justifyContent: 'center', width: 38 },
  warrantyPill: { backgroundColor: '#e4eee9', borderRadius: 9, paddingHorizontal: 7, paddingVertical: 3 },
  warrantyPillText: { color: '#426052', fontSize: 9, fontWeight: '800' },
  warrantySoon: { backgroundColor: '#fbecd0' },
  warrantySoonText: { color: '#855712' },
  warrantyTitle: { color: '#6e501f', fontSize: 14, fontWeight: '800' },
});
