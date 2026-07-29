import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { createRepair } from '@/features/repairs/repair-repository';

export default function NewRepairScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const db = useSQLiteContext();
  const [title, setTitle] = useState('');
  const [serviceDate, setServiceDate] = useState(new Date().toISOString().slice(0, 10));
  const [contractor, setContractor] = useState('');
  const [cost, setCost] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!itemId) return;
    setSaving(true);
    setError(undefined);
    try {
      await createRepair(db, { itemId, title, serviceDate, contractor, cost, notes });
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this repair.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>SERVICE HISTORY</Text>
        <Text style={styles.title}>Record a repair</Text>
        <Text style={styles.body}>Keep a simple record of what happened, who helped, and what it cost.</Text>
      </View>
      <Field label="What was done?" onChangeText={setTitle} placeholder="Replaced drain pump" value={title} />
      <Field label="Service date" onChangeText={setServiceDate} placeholder="YYYY-MM-DD" value={serviceDate} />
      <Field label="Contractor" onChangeText={setContractor} placeholder="Company or person" value={contractor} />
      <Field keyboardType="decimal-pad" label="Cost" onChangeText={setCost} placeholder="0.00" value={cost} />
      <View style={styles.field}>
        <Text style={styles.label}>Notes</Text>
        <TextInput accessibilityLabel="Repair notes" multiline onChangeText={setNotes} placeholder="Parts, diagnosis, or follow-up" style={[styles.input, styles.notes]} value={notes} />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <View style={styles.actions}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={saving} onPress={save} style={styles.primaryButton}>
          <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save repair'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

function Field({ label, ...props }: { label: string; onChangeText: (value: string) => void; placeholder: string; value: string; keyboardType?: 'decimal-pad' }) {
  return <View style={styles.field}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} style={styles.input} {...props} /></View>;
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10 },
  body: { color: '#66716f', fontSize: 15, lineHeight: 22 },
  cancelButton: { alignItems: 'center', borderColor: '#bdc5c1', borderRadius: 13, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 52 },
  cancelText: { color: '#405049', fontWeight: '700' },
  error: { color: '#a13d32' },
  eyebrow: { color: '#2f6651', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  field: { gap: 8 },
  input: { backgroundColor: '#fff', borderColor: '#d5dad7', borderRadius: 12, borderWidth: 1, color: '#1f2c28', fontSize: 16, minHeight: 50, paddingHorizontal: 14, paddingVertical: 12 },
  intro: { gap: 7 },
  label: { color: '#27342f', fontSize: 14, fontWeight: '700' },
  notes: { minHeight: 100, textAlignVertical: 'top' },
  primaryButton: { alignItems: 'center', backgroundColor: '#263b33', borderRadius: 13, flex: 2, justifyContent: 'center', minHeight: 52 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  title: { color: '#1f2c28', fontSize: 29, fontWeight: '800' },
});
