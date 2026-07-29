import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppFrame } from '@/components/app-frame';
import {
  listEssentials,
  type HomeEssential,
} from '@/features/essentials/essential-repository';
import { getHome } from '@/features/home/home-repository';

const templates = [
  { category: 'Utility shutoff', title: 'Main water shutoff', icon: 'water-outline' },
  { category: 'Utility shutoff', title: 'Electrical panel', icon: 'flash-outline' },
  { category: 'Wi-Fi', title: 'Home Wi-Fi', icon: 'wifi-outline' },
  { category: 'Paint', title: 'Wall paint color', icon: 'color-palette-outline' },
] as const;

const categoryIcons: Record<string, keyof typeof Ionicons.glyphMap> = {
  'Utility shutoff': 'water-outline',
  'Wi-Fi': 'wifi-outline',
  Paint: 'color-palette-outline',
  Emergency: 'medkit-outline',
  Contractor: 'construct-outline',
  'Household info': 'home-outline',
  Other: 'bookmark-outline',
};

export default function EssentialsScreen() {
  const db = useSQLiteContext();
  const [essentials, setEssentials] = useState<HomeEssential[]>([]);
  const [revealed, setRevealed] = useState<Set<string>>(new Set());
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
      setEssentials(await listEssentials(db, home.id));
    } catch {
      setError('Could not load Home Essentials.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => void load(), [load]));

  function toggleReveal(id: string) {
    setRevealed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <AppFrame>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.eyebrow}>QUICK ACCESS</Text>
            <Text style={styles.title}>Home Essentials</Text>
            <Text style={styles.subtitle}>The practical details people need in a hurry.</Text>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/essentials/new')} style={styles.addButton}>
            <Ionicons color="#fff" name="add" size={20} />
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        </View>

        {loading ? <ActivityIndicator style={styles.loader} /> : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}

        {!loading && essentials.length === 0 ? (
          <View style={styles.emptyCard}>
            <View style={styles.emptyIcon}>
              <Ionicons color="#2f6651" name="key-outline" size={28} />
            </View>
            <Text style={styles.emptyTitle}>Start with something important</Text>
            <Text style={styles.emptyBody}>
              Add a shutoff location, Wi-Fi details, paint color, or any instruction your household relies on.
            </Text>
          </View>
        ) : null}

        {essentials.length > 0 ? (
          <View style={styles.cards}>
            {essentials.map((essential) => {
              const hidden = essential.isSensitive && !revealed.has(essential.id);
              return (
                <Pressable
                  accessibilityRole="button"
                  key={essential.id}
                  onPress={() => router.push({ pathname: '/essentials/[id]', params: { id: essential.id } })}
                  style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
                  <View style={styles.cardTop}>
                    <View style={styles.cardIcon}>
                      <Ionicons
                        color="#2f6651"
                        name={categoryIcons[essential.category] ?? 'bookmark-outline'}
                        size={21}
                      />
                    </View>
                    <View style={styles.cardCopy}>
                      <Text style={styles.category}>{essential.category.toUpperCase()}</Text>
                      <Text style={styles.cardTitle}>{essential.title}</Text>
                    </View>
                    <Ionicons color="#809089" name="chevron-forward" size={20} />
                  </View>
                  {essential.value ? (
                    <View style={styles.valueRow}>
                      <Text numberOfLines={hidden ? 1 : 3} style={[styles.value, hidden && styles.hiddenValue]}>
                        {hidden ? '••••••••••••' : essential.value}
                      </Text>
                      {essential.isSensitive ? (
                        <Pressable
                          accessibilityLabel={hidden ? `Show ${essential.title}` : `Hide ${essential.title}`}
                          accessibilityRole="button"
                          onPress={(event) => {
                            event.stopPropagation();
                            toggleReveal(essential.id);
                          }}
                          style={styles.eyeButton}>
                          <Ionicons color="#49675b" name={hidden ? 'eye-outline' : 'eye-off-outline'} size={20} />
                        </Pressable>
                      ) : null}
                    </View>
                  ) : null}
                  {essential.notes ? <Text numberOfLines={2} style={styles.notes}>{essential.notes}</Text> : null}
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <Text style={styles.sectionLabel}>STARTER TEMPLATES</Text>
        <View style={styles.templates}>
          {templates.map((template) => (
            <Pressable
              accessibilityRole="button"
              key={template.title}
              onPress={() => router.push({
                pathname: '/essentials/new',
                params: { category: template.category, title: template.title },
              })}
              style={({ pressed }) => [styles.template, pressed && styles.pressed]}>
              <Ionicons color="#49675b" name={template.icon} size={21} />
              <Text style={styles.templateText}>{template.title}</Text>
              <Ionicons color="#8a9691" name="add-circle-outline" size={20} />
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  addButton: { alignItems: 'center', backgroundColor: '#263b33', borderRadius: 12, flexDirection: 'row', gap: 5, paddingHorizontal: 13, paddingVertical: 10 },
  addText: { color: '#fff', fontSize: 14, fontWeight: '800' },
  card: { backgroundColor: '#fff', borderColor: '#e0e4e1', borderRadius: 16, borderWidth: 1, gap: 11, padding: 15 },
  cardCopy: { flex: 1 },
  cardIcon: { alignItems: 'center', backgroundColor: '#e5f0ea', borderRadius: 11, height: 40, justifyContent: 'center', width: 40 },
  cards: { gap: 10 },
  cardTitle: { color: '#26332f', fontSize: 17, fontWeight: '800', marginTop: 2 },
  cardTop: { alignItems: 'center', flexDirection: 'row', gap: 11 },
  category: { color: '#5f786d', fontSize: 10, fontWeight: '800', letterSpacing: 0.8 },
  content: { padding: 20, paddingBottom: 40 },
  emptyBody: { color: '#68736f', fontSize: 14, lineHeight: 21, textAlign: 'center' },
  emptyCard: { alignItems: 'center', backgroundColor: '#e7f1ec', borderRadius: 18, gap: 8, padding: 22 },
  emptyIcon: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 25, height: 50, justifyContent: 'center', marginBottom: 2, width: 50 },
  emptyTitle: { color: '#285543', fontSize: 18, fontWeight: '800' },
  error: { color: '#9b352f', marginVertical: 18, textAlign: 'center' },
  eyeButton: { alignItems: 'center', height: 34, justifyContent: 'center', width: 34 },
  eyebrow: { color: '#2f6651', fontSize: 12, fontWeight: '800', letterSpacing: 1.1 },
  header: { alignItems: 'center', flexDirection: 'row', gap: 12, marginBottom: 22 },
  headerCopy: { flex: 1 },
  hiddenValue: { letterSpacing: 2 },
  loader: { marginVertical: 30 },
  notes: { color: '#74807b', fontSize: 13, lineHeight: 19 },
  pressed: { opacity: 0.7 },
  sectionLabel: { color: '#53615c', fontSize: 12, fontWeight: '800', letterSpacing: 0.8, marginBottom: 9, marginTop: 26 },
  subtitle: { color: '#68736f', fontSize: 14, lineHeight: 20, marginTop: 5 },
  template: { alignItems: 'center', backgroundColor: '#fff', borderBottomColor: '#e6e9e7', borderBottomWidth: 1, flexDirection: 'row', gap: 11, minHeight: 57, paddingHorizontal: 14 },
  templates: { borderColor: '#e0e4e1', borderRadius: 15, borderWidth: 1, overflow: 'hidden' },
  templateText: { color: '#34413d', flex: 1, fontSize: 15, fontWeight: '700' },
  title: { color: '#1f2c28', fontSize: 29, fontWeight: '800', marginTop: 3 },
  value: { color: '#34413d', flex: 1, fontSize: 15, fontWeight: '600', lineHeight: 21 },
  valueRow: { alignItems: 'center', backgroundColor: '#f5f6f3', borderRadius: 11, flexDirection: 'row', minHeight: 44, paddingHorizontal: 12 },
});
