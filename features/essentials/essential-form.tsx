import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  essentialCategories,
  type EssentialCategory,
  type EssentialInput,
} from './essential-repository';

type Props = {
  initial?: EssentialInput;
  error?: string;
  isEditing?: boolean;
  onCancel: () => void;
  onDelete?: () => void;
  onSubmit: (input: EssentialInput) => Promise<void>;
  saving: boolean;
};

export function EssentialForm({ initial, error, isEditing = false, onCancel, onDelete, onSubmit, saving }: Props) {
  const [category, setCategory] = useState<EssentialCategory>(initial?.category ?? 'Household info');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [value, setValue] = useState(initial?.value ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [isSensitive, setIsSensitive] = useState(initial?.isSensitive ?? false);
  const [validation, setValidation] = useState<string>();

  useEffect(() => {
    if (!initial) return;
    setCategory(initial.category);
    setTitle(initial.title);
    setValue(initial.value);
    setNotes(initial.notes);
    setIsSensitive(initial.isSensitive);
  }, [initial]);

  async function submit() {
    if (!title.trim()) {
      setValidation('Enter a title.');
      return;
    }
    setValidation(undefined);
    await onSubmit({ category, title, value, notes, isSensitive });
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Text style={styles.title}>{isEditing ? 'Edit essential' : 'Add an essential'}</Text>
          <Text style={styles.subtitle}>Save the information someone needs when you are not there.</Text>
        </View>

        <Text style={styles.label}>Category</Text>
        <View style={styles.chips}>
          {essentialCategories.map((option) => {
            const selected = option === category;
            return (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected }}
                key={option}
                onPress={() => setCategory(option)}
                style={[styles.chip, selected && styles.selectedChip]}>
                <Text style={[styles.chipText, selected && styles.selectedChipText]}>{option}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Title</Text>
        <TextInput
          autoCapitalize="sentences"
          onChangeText={setTitle}
          placeholder="e.g. Main water shutoff"
          placeholderTextColor="#8b9490"
          style={styles.input}
          value={title}
        />

        <Text style={styles.label}>Value or location</Text>
        <TextInput
          autoCapitalize="sentences"
          onChangeText={setValue}
          placeholder="e.g. Garage, behind the utility sink"
          placeholderTextColor="#8b9490"
          style={styles.input}
          value={value}
        />

        <Text style={styles.label}>Instructions or notes</Text>
        <TextInput
          multiline
          onChangeText={setNotes}
          placeholder="Add any practical steps someone should know"
          placeholderTextColor="#8b9490"
          style={[styles.input, styles.notes]}
          textAlignVertical="top"
          value={notes}
        />

        <View style={styles.sensitiveRow}>
          <View style={styles.sensitiveCopy}>
            <View style={styles.sensitiveTitleRow}>
              <Ionicons color="#40534b" name="eye-off-outline" size={18} />
              <Text style={styles.sensitiveTitle}>Hide value by default</Text>
            </View>
            <Text style={styles.sensitiveBody}>Useful for Wi-Fi passwords or access codes.</Text>
          </View>
          <Switch
            onValueChange={setIsSensitive}
            trackColor={{ false: '#cfd6d2', true: '#6b9a86' }}
            value={isSensitive}
          />
        </View>

        {validation || error ? <Text style={styles.error}>{validation ?? error}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={submit}
          style={styles.primaryButton}>
          <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save essential'}</Text>
        </Pressable>
        <Pressable accessibilityRole="button" disabled={saving} onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        {onDelete ? (
          <Pressable accessibilityRole="button" disabled={saving} onPress={onDelete} style={styles.deleteButton}>
            <Text style={styles.deleteText}>Delete essential</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  cancelButton: { alignItems: 'center', justifyContent: 'center', minHeight: 48 },
  cancelText: { color: '#53615c', fontSize: 15, fontWeight: '700' },
  chip: { backgroundColor: '#fff', borderColor: '#d5dcd8', borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, paddingVertical: 8 },
  chipText: { color: '#58645f', fontSize: 13, fontWeight: '600' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  content: { padding: 20, paddingBottom: 40 },
  deleteButton: { alignItems: 'center', borderTopColor: '#e1d5d3', borderTopWidth: 1, justifyContent: 'center', marginTop: 8, minHeight: 54 },
  deleteText: { color: '#9b352f', fontSize: 15, fontWeight: '700' },
  error: { color: '#9b352f', fontSize: 14, marginBottom: 12 },
  flex: { backgroundColor: '#f8f7f3', flex: 1 },
  input: { backgroundColor: '#fff', borderColor: '#cbd3cf', borderRadius: 12, borderWidth: 1, color: '#1f2c28', fontSize: 16, minHeight: 50, paddingHorizontal: 14, paddingVertical: 12 },
  intro: { marginBottom: 20 },
  label: { color: '#34413d', fontSize: 14, fontWeight: '700', marginBottom: 7, marginTop: 16 },
  notes: { minHeight: 112 },
  primaryButton: { alignItems: 'center', backgroundColor: '#263b33', borderRadius: 13, justifyContent: 'center', marginTop: 22, minHeight: 52 },
  primaryText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  selectedChip: { backgroundColor: '#dfeee7', borderColor: '#7ba38f' },
  selectedChipText: { color: '#285543' },
  sensitiveBody: { color: '#75807b', fontSize: 12, lineHeight: 17 },
  sensitiveCopy: { flex: 1 },
  sensitiveRow: { alignItems: 'center', backgroundColor: '#eef3f0', borderRadius: 14, flexDirection: 'row', gap: 14, marginTop: 18, padding: 14 },
  sensitiveTitle: { color: '#34413d', fontSize: 14, fontWeight: '700' },
  sensitiveTitleRow: { alignItems: 'center', flexDirection: 'row', gap: 7, marginBottom: 3 },
  subtitle: { color: '#68736f', fontSize: 15, lineHeight: 22 },
  title: { color: '#1f2c28', fontSize: 27, fontWeight: '800', marginBottom: 6 },
});
