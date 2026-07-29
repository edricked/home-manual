import { Ionicons } from '@expo/vector-icons';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppFrame } from '@/components/app-frame';
import { Screen } from '@/components/screen';
import { listEssentials, type HomeEssential } from '@/features/essentials/essential-repository';
import { getHome, type Home } from '@/features/home/home-repository';
import { listItems, type Item } from '@/features/items/item-repository';
import { getDueState, listMaintenanceTasks } from '@/features/maintenance/maintenance-repository';

export default function ItemListScreen() {
  const db = useSQLiteContext();
  const [home, setHome] = useState<Home>();
  const [items, setItems] = useState<Item[]>([]);
  const [essentials, setEssentials] = useState<HomeEssential[]>([]);
  const [attentionCount, setAttentionCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>();

  const load = useCallback(async () => {
    setError(undefined);
    try {
      const currentHome = await getHome(db);
      if (!currentHome) {
        router.replace('/onboarding');
        return;
      }
      const [rows, tasks, essentialRows] = await Promise.all([
        listItems(db, currentHome.id),
        listMaintenanceTasks(db, currentHome.id),
        listEssentials(db, currentHome.id),
      ]);
      setHome(currentHome);
      setItems(rows);
      setEssentials(essentialRows);
      setAttentionCount(
        tasks.filter((task) => ['overdue', 'due', 'soon'].includes(getDueState(task.nextDueDate).key)).length,
      );
    } catch {
      setError('Could not load your home.');
    } finally {
      setLoading(false);
    }
  }, [db]);

  useFocusEffect(useCallback(() => void load(), [load]));

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  }

  return (
    <AppFrame>
      <Screen>
        <View style={styles.header}>
          <View style={styles.brand}>
            <Image source={require('@/assets/images/home-manual-logo-v2.png')} style={styles.logo} />
            <View style={styles.headerText}>
              <Text style={styles.eyebrow}>HOME MANUAL</Text>
              <Text style={styles.title}>{home?.name}</Text>
              <Text style={styles.subtitle}>{items.length} {items.length === 1 ? 'item' : 'items'} saved locally</Text>
            </View>
          </View>
          <Pressable accessibilityRole="button" onPress={() => router.push('/items/new')} style={styles.addButton}>
            <Text style={styles.addText}>+ Add item</Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => router.push('/maintenance')}
          style={({ pressed }) => [styles.maintenanceCard, pressed && styles.rowPressed]}>
          <View style={styles.maintenanceIcon}><Text style={styles.maintenanceIconText}>✓</Text></View>
          <View style={styles.rowText}>
            <Text style={styles.maintenanceTitle}>Home maintenance</Text>
            <Text style={styles.maintenanceMeta}>
              {attentionCount === 0
                ? 'You’re all caught up'
                : `${attentionCount} ${attentionCount === 1 ? 'task needs' : 'tasks need'} attention`}
            </Text>
          </View>
          <Text style={styles.cardChevron}>›</Text>
        </Pressable>

        <View style={styles.essentialsSection}>
          <View style={styles.sectionHeader}>
            <View>
              <Text style={styles.sectionTitle}>HOME ESSENTIALS</Text>
              <Text style={styles.sectionSubtitle}>Important details, close at hand</Text>
            </View>
            <Pressable accessibilityRole="button" onPress={() => router.push('/essentials' as Href)}>
              <Text style={styles.viewAll}>{essentials.length ? 'View all' : 'Set up'}</Text>
            </Pressable>
          </View>
          {essentials.length ? (
            <View style={styles.essentialCards}>
              {essentials.slice(0, 3).map((essential) => (
                <Pressable
                  accessibilityRole="button"
                  key={essential.id}
                  onPress={() => router.push({ pathname: '/essentials/[id]', params: { id: essential.id } })}
                  style={({ pressed }) => [styles.essentialCard, pressed && styles.rowPressed]}>
                  <View style={styles.essentialIcon}>
                    <Ionicons color="#2f6651" name={essential.category === 'Wi-Fi' ? 'wifi-outline' : 'key-outline'} size={19} />
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.essentialTitle}>{essential.title}</Text>
                    <Text numberOfLines={1} style={styles.essentialValue}>
                      {essential.isSensitive ? 'Hidden value' : essential.value || essential.category}
                    </Text>
                  </View>
                  <Ionicons color="#7d8c85" name="chevron-forward" size={19} />
                </Pressable>
              ))}
            </View>
          ) : (
            <Pressable
              accessibilityRole="button"
              onPress={() => router.push('/essentials' as Href)}
              style={({ pressed }) => [styles.essentialsEmpty, pressed && styles.rowPressed]}>
              <View style={styles.essentialIcon}>
                <Ionicons color="#2f6651" name="key-outline" size={20} />
              </View>
              <Text style={styles.essentialsEmptyText}>Add shutoffs, Wi-Fi, paint colors, and practical instructions</Text>
              <Ionicons color="#5f786d" name="add-circle-outline" size={22} />
            </Pressable>
          )}
        </View>

        {error ? (
          <View style={styles.empty}>
            <Text style={styles.error}>{error}</Text>
            <Pressable accessibilityRole="button" onPress={load}><Text style={styles.link}>Try again</Text></Pressable>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Start with one useful item</Text>
            <Text style={styles.emptyBody}>Add an appliance or home system. Only its name is required.</Text>
            <Pressable accessibilityRole="button" onPress={() => router.push('/items/new')} style={styles.primaryButton}>
              <Text style={styles.primaryText}>Add your first item</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.itemsSection}>
            <Text style={styles.sectionTitle}>YOUR ITEMS</Text>
            <FlatList
              contentContainerStyle={styles.list}
              data={items}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/items/[id]', params: { id: item.id } })}
                  style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
                  <View style={styles.rowText}>
                    <Text style={styles.itemName}>{item.name}</Text>
                    <Text style={styles.meta}>
                      {[item.category, item.areaName, item.modelNumber].filter(Boolean).join(' · ') || 'No details yet'}
                    </Text>
                  </View>
                  <Text style={styles.chevron}>›</Text>
                </Pressable>
              )}
              scrollEnabled={false}
            />
          </View>
        )}
      </Screen>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  addButton: { backgroundColor: '#263b33', borderRadius: 12, paddingHorizontal: 14, paddingVertical: 11 },
  addText: { color: '#fff', fontWeight: '700' },
  brand: { alignItems: 'center', flex: 1, flexDirection: 'row', gap: 11 },
  cardChevron: { color: '#658072', fontSize: 28 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  chevron: { color: '#69737d', fontSize: 30 },
  empty: { alignItems: 'center', flex: 1, gap: 12, justifyContent: 'center', paddingHorizontal: 20 },
  emptyBody: { color: '#5f6368', fontSize: 16, lineHeight: 23, textAlign: 'center' },
  emptyTitle: { color: '#1f2933', fontSize: 22, fontWeight: '700', textAlign: 'center' },
  essentialCard: { alignItems: 'center', borderBottomColor: '#e7eae8', borderBottomWidth: 1, flexDirection: 'row', gap: 11, minHeight: 64, paddingHorizontal: 13 },
  essentialCards: { backgroundColor: '#fff', borderColor: '#e1e5e2', borderRadius: 15, borderWidth: 1, overflow: 'hidden' },
  essentialIcon: { alignItems: 'center', backgroundColor: '#e5f0ea', borderRadius: 10, height: 36, justifyContent: 'center', width: 36 },
  essentialsEmpty: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#dfe5e1', borderRadius: 15, borderWidth: 1, flexDirection: 'row', gap: 11, padding: 14 },
  essentialsEmptyText: { color: '#52605b', flex: 1, fontSize: 13, lineHeight: 19 },
  essentialsSection: { gap: 10 },
  essentialTitle: { color: '#2c3935', fontSize: 15, fontWeight: '700' },
  essentialValue: { color: '#74807b', fontSize: 12, marginTop: 3 },
  error: { color: '#b42318', textAlign: 'center' },
  eyebrow: { color: '#2f6651', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  header: { alignItems: 'center', flexDirection: 'row', justifyContent: 'space-between', paddingTop: 8 },
  headerText: { flex: 1 },
  itemName: { color: '#25332e', fontSize: 17, fontWeight: '700' },
  itemsSection: { gap: 10 },
  link: { color: '#355d72', fontWeight: '600' },
  list: { backgroundColor: '#fff', borderRadius: 16, paddingHorizontal: 16 },
  logo: { borderRadius: 12, height: 48, width: 48 },
  maintenanceCard: { alignItems: 'center', backgroundColor: '#e5f0ea', borderRadius: 17, flexDirection: 'row', gap: 13, minHeight: 82, padding: 16 },
  maintenanceIcon: { alignItems: 'center', backgroundColor: '#fff', borderRadius: 21, height: 42, justifyContent: 'center', width: 42 },
  maintenanceIconText: { color: '#2f6651', fontSize: 20, fontWeight: '800' },
  maintenanceMeta: { color: '#597066', fontSize: 13, marginTop: 3 },
  maintenanceTitle: { color: '#264b3c', fontSize: 16, fontWeight: '800' },
  meta: { color: '#68737d', fontSize: 14, marginTop: 4 },
  primaryButton: { backgroundColor: '#263b33', borderRadius: 12, justifyContent: 'center', marginTop: 8, minHeight: 48, paddingHorizontal: 18 },
  primaryText: { color: '#ffffff', fontWeight: '600' },
  row: { alignItems: 'center', borderBottomColor: '#e8eae7', borderBottomWidth: 1, flexDirection: 'row', minHeight: 76, paddingVertical: 12 },
  rowPressed: { opacity: 0.65 },
  rowText: { flex: 1 },
  sectionTitle: { color: '#5e6965', fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  sectionHeader: { alignItems: 'flex-end', flexDirection: 'row', justifyContent: 'space-between' },
  sectionSubtitle: { color: '#7a837f', fontSize: 12, marginTop: 3 },
  subtitle: { color: '#737d79', fontSize: 13, marginTop: 4 },
  title: { color: '#1f2c28', fontSize: 30, fontWeight: '800', letterSpacing: -0.5, marginTop: 2 },
  viewAll: { color: '#2f6651', fontSize: 13, fontWeight: '800' },
});
