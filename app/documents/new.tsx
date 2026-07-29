import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import {
  createDocument,
  documentTypes,
  formatFileSize,
  type DocumentType,
} from '@/features/documents/document-repository';
import { getHome } from '@/features/home/home-repository';
import { listItems, type Item } from '@/features/items/item-repository';

type PickedFile = {
  name: string;
  uri: string;
  mimeType: string | null;
  size: number | null;
};

export default function NewDocumentScreen() {
  const { itemId } = useLocalSearchParams<{ itemId: string }>();
  const db = useSQLiteContext();
  const [items, setItems] = useState<Item[]>([]);
  const [selectedItemId, setSelectedItemId] = useState(itemId ?? '');
  const [itemPickerOpen, setItemPickerOpen] = useState(false);
  const [file, setFile] = useState<PickedFile>();
  const [type, setType] = useState<DocumentType>('Manual');
  const [title, setTitle] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [warrantyExpires, setWarrantyExpires] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (itemId) setSelectedItemId(itemId);
  }, [itemId]);

  useEffect(() => {
    getHome(db).then(async (home) => {
      if (!home) {
        router.replace('/onboarding');
        return;
      }
      setItems(await listItems(db, home.id));
    });
  }, [db]);

  async function pickFile() {
    const result = await DocumentPicker.getDocumentAsync({
      copyToCacheDirectory: true,
      multiple: false,
      type: ['application/pdf', 'image/*'],
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setFile({
      name: asset.name,
      uri: asset.uri,
      mimeType: asset.mimeType ?? null,
      size: asset.size ?? null,
    });
    if (!title) setTitle(asset.name.replace(/\.[^.]+$/, '').replace(/[-_]/g, ' '));
  }

  async function save() {
    if (!selectedItemId || !file) {
      setError(!selectedItemId ? 'Choose the item this document belongs to.' : 'Choose a file first.');
      return;
    }
    setSaving(true);
    setError(undefined);
    try {
      await createDocument(db, {
        itemId: selectedItemId,
        type,
        title,
        originalName: file.name,
        sourceUri: file.uri,
        mimeType: file.mimeType,
        sizeBytes: file.size,
        purchaseDate,
        warrantyExpires,
      });
      router.back();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this document.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>KEEP IT TOGETHER</Text>
        <Text style={styles.title}>Add a document</Text>
        <Text style={styles.body}>Files stay with your local Home Manual data.</Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>Related item</Text>
        <Pressable
          accessibilityLabel="Related item"
          accessibilityRole="button"
          onPress={() => setItemPickerOpen(true)}
          style={styles.select}>
          <Text style={[styles.selectText, !selectedItemId && styles.placeholder]}>
            {items.find((item) => item.id === selectedItemId)?.name ?? 'Choose an item'}
          </Text>
          <Ionicons color="#52615b" name="chevron-down" size={18} />
        </Pressable>
      </View>

      <Pressable accessibilityRole="button" onPress={pickFile} style={styles.filePicker}>
        <View style={styles.fileIcon}><Text style={styles.fileIconText}>{file ? '✓' : '+'}</Text></View>
        <View style={styles.fileText}>
          <Text style={styles.fileTitle}>{file ? file.name : 'Choose a PDF or photo'}</Text>
          <Text style={styles.fileMeta}>
            {file ? [file.mimeType, formatFileSize(file.size)].filter(Boolean).join(' · ') : 'From Files or cloud storage'}
          </Text>
        </View>
        <Text style={styles.chooseText}>{file ? 'Change' : 'Choose'}</Text>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.label}>Document type</Text>
        <View style={styles.chips}>
          {documentTypes.map((option) => (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: type === option }}
              key={option}
              onPress={() => setType(option)}
              style={[styles.chip, type === option && styles.chipSelected]}>
              <Text style={[styles.chipText, type === option && styles.chipTextSelected]}>{option}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Field label="Title" onChangeText={setTitle} placeholder="Dishwasher manual" value={title} />
      <Field label="Purchase date" onChangeText={setPurchaseDate} placeholder="YYYY-MM-DD" value={purchaseDate} />
      <Field label="Warranty expires" onChangeText={setWarrantyExpires} placeholder="YYYY-MM-DD" value={warrantyExpires} />

      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        accessibilityRole="button"
        disabled={saving}
        onPress={save}
        style={[styles.primaryButton, saving && styles.disabled]}>
        <Text style={styles.primaryText}>{saving ? 'Saving…' : 'Save document'}</Text>
      </Pressable>

      <Modal animationType="fade" onRequestClose={() => setItemPickerOpen(false)} transparent visible={itemPickerOpen}>
        <Pressable accessibilityRole="button" onPress={() => setItemPickerOpen(false)} style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.optionSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Choose the related item</Text>
            {items.length ? items.map((item) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selectedItemId === item.id }}
                key={item.id}
                onPress={() => {
                  setSelectedItemId(item.id);
                  setItemPickerOpen(false);
                }}
                style={styles.optionRow}>
                <View>
                  <Text style={styles.optionText}>{item.name}</Text>
                  <Text style={styles.optionMeta}>{[item.category, item.areaName].filter(Boolean).join(' · ') || 'No details'}</Text>
                </View>
                {selectedItemId === item.id ? <Ionicons color="#2f6651" name="checkmark" size={19} /> : null}
              </Pressable>
            )) : (
              <View style={styles.noItems}>
                <Text style={styles.optionText}>Add an item before attaching a document.</Text>
                <Pressable accessibilityRole="button" onPress={() => router.replace('/items/new')} style={styles.addItemButton}>
                  <Text style={styles.addItemText}>Add item</Text>
                </Pressable>
              </View>
            )}
          </View>
        </Pressable>
      </Modal>
    </Screen>
  );
}

function Field({
  label,
  onChangeText,
  placeholder,
  value,
}: {
  label: string;
  onChangeText: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        accessibilityLabel={label}
        autoCapitalize="none"
        onChangeText={onChangeText}
        placeholder={placeholder}
        style={styles.input}
        value={value}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { color: '#66716f', fontSize: 15, lineHeight: 22 },
  chip: { backgroundColor: '#ebece8', borderRadius: 20, paddingHorizontal: 14, paddingVertical: 10 },
  chipSelected: { backgroundColor: '#2f6651' },
  chipText: { color: '#4f5d58', fontSize: 13, fontWeight: '600' },
  chipTextSelected: { color: '#fff' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chooseText: { color: '#2f6651', fontSize: 13, fontWeight: '800' },
  disabled: { opacity: 0.5 },
  error: { color: '#a13d32', fontSize: 14 },
  eyebrow: { color: '#2f6651', fontSize: 12, fontWeight: '800', letterSpacing: 1.2 },
  fileIcon: { alignItems: 'center', backgroundColor: '#e5f0ea', borderRadius: 21, height: 42, justifyContent: 'center', width: 42 },
  fileIconText: { color: '#2f6651', fontSize: 21, fontWeight: '800' },
  fileMeta: { color: '#75807b', fontSize: 12, marginTop: 3 },
  filePicker: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#d9dedb', borderRadius: 16, borderWidth: 1, flexDirection: 'row', gap: 12, minHeight: 78, padding: 15 },
  fileText: { flex: 1 },
  fileTitle: { color: '#26332f', fontSize: 15, fontWeight: '700' },
  input: { backgroundColor: '#fff', borderColor: '#d9dedb', borderRadius: 12, borderWidth: 1, color: '#1f2c28', fontSize: 16, minHeight: 50, paddingHorizontal: 14 },
  intro: { gap: 7 },
  label: { color: '#27342f', fontSize: 15, fontWeight: '700' },
  modalBackdrop: { backgroundColor: 'rgba(18, 27, 23, 0.45)', flex: 1, justifyContent: 'flex-end' },
  noItems: { gap: 14, paddingBottom: 15, paddingTop: 10 },
  optionMeta: { color: '#75807b', fontSize: 12, marginTop: 3 },
  optionRow: { alignItems: 'center', borderBottomColor: '#e8eae7', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 61, paddingHorizontal: 4 },
  optionSheet: { alignSelf: 'center', backgroundColor: '#f8f7f3', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxWidth: 560, paddingBottom: 24, paddingHorizontal: 20, width: '100%' },
  optionText: { color: '#293630', fontSize: 16, fontWeight: '700' },
  placeholder: { color: '#8a918e' },
  primaryButton: { alignItems: 'center', backgroundColor: '#263b33', borderRadius: 14, justifyContent: 'center', minHeight: 54 },
  primaryText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  section: { gap: 9 },
  select: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#c9ced3', borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 50, paddingHorizontal: 14 },
  selectText: { color: '#27342f', fontSize: 16 },
  sheetHandle: { alignSelf: 'center', backgroundColor: '#c6ccc8', borderRadius: 2, height: 4, marginBottom: 14, marginTop: 10, width: 38 },
  sheetTitle: { color: '#1f2c28', fontSize: 19, fontWeight: '800', marginBottom: 5 },
  addItemButton: { alignItems: 'center', backgroundColor: '#263b33', borderRadius: 11, minHeight: 46, justifyContent: 'center' },
  addItemText: { color: '#fff', fontWeight: '800' },
  title: { color: '#1f2c28', fontSize: 29, fontWeight: '800', letterSpacing: -0.5 },
});
