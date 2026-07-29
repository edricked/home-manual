import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { getHome, type Home } from '@/features/home/home-repository';
import { listItems, type Item } from '@/features/items/item-repository';
import { createMaintenanceTask } from '@/features/maintenance/maintenance-repository';

const intervals = [
  { days: 30, label: 'Monthly' },
  { days: 90, label: 'Every 3 months' },
  { days: 180, label: 'Every 6 months' },
  { days: 365, label: 'Yearly' },
];

function futureDate(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

export default function NewMaintenanceTaskScreen() {
  const db = useSQLiteContext();
  const [home, setHome] = useState<Home>();
  const [items, setItems] = useState<Item[]>([]);
  const [itemId, setItemId] = useState('');
  const [title, setTitle] = useState('');
  const [intervalDays, setIntervalDays] = useState(90);
  const [dueDate, setDueDate] = useState(futureDate(90));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getHome(db).then(async (currentHome) => {
      if (!currentHome) return router.replace('/onboarding');
      setHome(currentHome);
      const rows = await listItems(db, currentHome.id);
      setItems(rows);
      if (rows.length === 1) setItemId(rows[0].id);
    }).catch(() => setError('Could not load your items.'));
  }, [db]);

  const selectedItem = useMemo(() => items.find((item) => item.id === itemId), [itemId, items]);

  function chooseInterval(days: number) {
    setIntervalDays(days);
    setDueDate(futureDate(days));
  }

  async function save() {
    if (!home) return;
    setSaving(true);
    setError(undefined);
    try {
      await createMaintenanceTask(db, {
        homeId: home.id,
        itemId,
        title,
        intervalDays,
        nextDueDate: dueDate,
        notes: notes || null,
      });
      router.replace('/maintenance');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this task.');
    } finally {
      setSaving(false);
    }
  }

  if (!home && !error) return <View style={styles.center}><ActivityIndicator size="large" /></View>;

  return (
    <Screen>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>RECURRING CARE</Text>
        <Text style={styles.title}>Add a maintenance task</Text>
        <Text style={styles.body}>We’ll calculate the next due date each time you mark it done.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>For which item?</Text>
        {items.length === 0 ? (
          <View style={styles.notice}>
            <Text style={styles.noticeTitle}>Add an item first</Text>
            <Text style={styles.body}>Maintenance tasks stay attached to an appliance or home system.</Text>
            <Pressable onPress={() => router.push('/items/new')} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Add an item</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.choiceGrid}>
            {items.map((item) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: item.id === itemId }}
                key={item.id}
                onPress={() => setItemId(item.id)}
                style={[styles.choice, item.id === itemId && styles.choiceSelected]}>
                <Text style={[styles.choiceText, item.id === itemId && styles.choiceTextSelected]}>{item.name}</Text>
                <Text style={styles.choiceMeta}>{item.areaName || item.category || 'Home item'}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>What needs doing?</Text>
        <TextInput
          accessibilityLabel="Task name"
          onChangeText={setTitle}
          placeholder={selectedItem ? `Care for ${selectedItem.name}` : 'Clean filter'}
          style={styles.input}
          value={title}
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Repeat</Text>
        <View style={styles.chips}>
          {intervals.map((interval) => (
            <Pressable
              key={interval.days}
              onPress={() => chooseInterval(interval.days)}
              style={[styles.chip, interval.days === intervalDays && styles.chipSelected]}>
              <Text style={[styles.chipText, interval.days === intervalDays && styles.chipTextSelected]}>
                {interval.label}
              </Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>First due date</Text>
        <TextInput
          accessibilityLabel="First due date"
          autoCapitalize="none"
          onChangeText={setDueDate}
          placeholder="YYYY-MM-DD"
          style={styles.input}
          value={dueDate}
        />
        <Text style={styles.hint}>Use YYYY-MM-DD</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Notes <Text style={styles.optional}>optional</Text></Text>
        <TextInput
          accessibilityLabel="Notes"
          multiline
          onChangeText={setNotes}
          placeholder="Tools, supplies, or useful instructions"
          style={[styles.input, styles.notes]}
          value={notes}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={saving || items.length === 0}
        onPress={save}
        style={[styles.primaryButton, (saving || items.length === 0) && styles.disabled]}>
        <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save maintenance task'}</Text>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: '#66716f', fontSize: 15, lineHeight: 22 },
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
  choice: { backgroundColor: '#fff', borderColor: '#d9dedb', borderRadius: 14, borderWidth: 1, minWidth: 150, padding: 14 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choiceMeta: { color: '#77817f', fontSize: 12, marginTop: 3 },
  choiceSelected: { backgroundColor: '#e5f0ea', borderColor: '#2f6651', borderWidth: 2 },
  choiceText: { color: '#26332f', fontSize: 15, fontWeight: '600' },
  choiceTextSelected: { color: '#214f3e' },
  chip: { backgroundColor: '#ebece8', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  chipSelected: { backgroundColor: '#2f6651' },
  chipText: { color: '#4f5d58', fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  disabled: { opacity: 0.45 },
  error: { color: '#a13d32', fontSize: 14 },
  eyebrow: { color: '#2f6651', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  hint: { color: '#7c8581', fontSize: 12, marginTop: -6 },
  input: { backgroundColor: '#fff', borderColor: '#d9dedb', borderRadius: 12, borderWidth: 1, color: '#1f2c28', fontSize: 16, minHeight: 50, paddingHorizontal: 14, paddingVertical: 12 },
  intro: { gap: 7 },
  label: { color: '#27342f', fontSize: 15, fontWeight: '700' },
  notes: { minHeight: 100, textAlignVertical: 'top' },
  notice: { backgroundColor: '#fff', borderRadius: 14, gap: 8, padding: 16 },
  noticeTitle: { color: '#26332f', fontSize: 17, fontWeight: '700' },
  optional: { color: '#7c8581', fontWeight: '400' },
  primaryButton: { alignItems: 'center', backgroundColor: '#263b33', borderRadius: 14, justifyContent: 'center', minHeight: 54 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  secondaryButton: { alignSelf: 'flex-start', borderColor: '#b9c5bf', borderRadius: 10, borderWidth: 1, marginTop: 4, paddingHorizontal: 14, paddingVertical: 10 },
  secondaryText: { color: '#2f6651', fontWeight: '700' },
  section: { gap: 9 },
  title: { color: '#1f2c28', fontSize: 29, fontWeight: '800', letterSpacing: -0.5 },
});
