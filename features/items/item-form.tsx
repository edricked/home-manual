import Ionicons from '@expo/vector-icons/Ionicons';
import { type ReactNode, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { ZodError } from 'zod';

import { Screen } from '@/components/screen';
import { type Item } from './item-repository';
import { itemInputSchema, type ItemInput } from './item-schema';

type Props = {
  error?: string;
  initialValue?: Item;
  footer?: ReactNode;
  onCancel?: () => void;
  onSubmit: (input: ItemInput) => Promise<void>;
  submitLabel: string;
};

type FormValue = {
  name: string;
  areaName: string;
  category: string;
  manufacturer: string;
  modelNumber: string;
  serialNumber: string;
  notes: string;
};

const areaOptions = [
  'Kitchen',
  'Living room',
  'Dining room',
  'Bedroom',
  'Bathroom',
  'Laundry',
  'Garage',
  'Utility',
  'Exterior',
] as const;

const categoryOptions = [
  'Appliance',
  'Heating & cooling',
  'Plumbing',
  'Electrical',
  'Safety',
  'Fixture',
  'Flooring',
  'Paint & finish',
  'Furniture',
  'Outdoor',
] as const;

function initialFormValue(item?: Item): FormValue {
  return {
    name: item?.name ?? '',
    areaName: item?.areaName ?? '',
    category: item?.category ?? '',
    manufacturer: item?.manufacturer ?? '',
    modelNumber: item?.modelNumber ?? '',
    serialNumber: item?.serialNumber ?? '',
    notes: item?.notes ?? '',
  };
}

export function ItemForm({ error, footer, initialValue, onCancel, onSubmit, submitLabel }: Props) {
  const [value, setValue] = useState(() => initialFormValue(initialValue));
  const [fieldError, setFieldError] = useState<string>();
  const [saving, setSaving] = useState(false);

  function update(field: keyof FormValue, nextValue: string) {
    setValue((current) => ({ ...current, [field]: nextValue }));
  }

  async function submit() {
    setFieldError(undefined);
    try {
      itemInputSchema.parse(value);
      setSaving(true);
      await onSubmit(value);
    } catch (caught) {
      if (caught instanceof ZodError) {
        setFieldError(caught.issues[0]?.message ?? 'Check the item details.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.intro}>
        <Text style={styles.title}>{initialValue ? initialValue.name : 'Add something useful'}</Text>
        <Text style={styles.body}>Only the name is required. Add the details you already know.</Text>
      </View>

      <View style={styles.form}>
        <Field autoFocus={!initialValue} label="Name" onChangeText={(text) => update('name', text)} placeholder="Kitchen dishwasher" value={value.name} />
        <SelectField
          label="Area"
          onChange={(text) => update('areaName', text)}
          options={areaOptions}
          placeholder="Choose an area"
          value={value.areaName}
        />
        <SelectField
          label="Category"
          onChange={(text) => update('category', text)}
          options={categoryOptions}
          placeholder="Choose a category"
          value={value.category}
        />
        <Field label="Manufacturer" onChangeText={(text) => update('manufacturer', text)} placeholder="Bosch" value={value.manufacturer} />
        <Field autoCapitalize="characters" label="Model number" onChangeText={(text) => update('modelNumber', text)} value={value.modelNumber} />
        <Field autoCapitalize="characters" label="Serial number" onChangeText={(text) => update('serialNumber', text)} value={value.serialNumber} />
        <Text style={styles.label}>Notes</Text>
        <TextInput
          accessibilityLabel="Notes"
          multiline
          onChangeText={(text) => update('notes', text)}
          style={[styles.input, styles.notes]}
          textAlignVertical="top"
          value={value.notes}
        />
        {fieldError || error ? <Text style={styles.error}>{fieldError ?? error}</Text> : null}
        <View style={styles.actions}>
          {onCancel ? (
            <Pressable accessibilityRole="button" onPress={onCancel} style={styles.cancelButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            disabled={saving}
            onPress={submit}
            style={({ pressed }) => [styles.button, onCancel && styles.buttonWithCancel, pressed && styles.pressed, saving && styles.disabled]}>
            <Text style={styles.buttonText}>{saving ? 'Saving…' : submitLabel}</Text>
          </Pressable>
        </View>
      </View>
      {footer}
    </Screen>
  );
}

type FieldProps = {
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters';
  autoFocus?: boolean;
  label: string;
  onChangeText: (value: string) => void;
  placeholder?: string;
  value: string;
};

function Field({ label, ...inputProps }: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput accessibilityLabel={label} style={styles.input} {...inputProps} />
    </View>
  );
}

function SelectField({
  label,
  onChange,
  options,
  placeholder,
  value,
}: {
  label: string;
  onChange: (value: string) => void;
  options: readonly string[];
  placeholder: string;
  value: string;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState(Boolean(value && !options.includes(value)));
  const displayValue = custom ? 'Other' : value;

  function choose(nextValue: string) {
    if (nextValue === '__other__') {
      setCustom(true);
      onChange('');
    } else {
      setCustom(false);
      onChange(nextValue);
    }
    setOpen(false);
  }

  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityLabel={label}
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.select, pressed && styles.pressed]}>
        <Text style={[styles.selectText, !displayValue && styles.placeholder]}>{displayValue || placeholder}</Text>
        <View style={styles.selectIcon}>
          <Ionicons color="#52615b" name="chevron-down" size={18} />
        </View>
      </Pressable>
      {custom ? (
        <TextInput
          accessibilityLabel={`Custom ${label.toLowerCase()}`}
          autoFocus
          onChangeText={onChange}
          placeholder={`Enter ${label.toLowerCase()}`}
          style={styles.input}
          value={value}
        />
      ) : null}

      <Modal animationType="fade" onRequestClose={() => setOpen(false)} transparent visible={open}>
        <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.modalBackdrop}>
          <View accessibilityViewIsModal style={styles.optionSheet}>
            <View style={styles.sheetHandle} />
            <Text style={styles.sheetTitle}>Choose {label.toLowerCase()}</Text>
            {options.map((option) => (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: value === option }}
                key={option}
                onPress={() => choose(option)}
                style={styles.optionRow}>
                <Text style={styles.optionText}>{option}</Text>
                {value === option ? <Text style={styles.optionCheck}>✓</Text> : null}
              </Pressable>
            ))}
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: custom }}
              onPress={() => choose('__other__')}
              style={styles.optionRow}>
              <Text style={styles.optionText}>Other…</Text>
              {custom ? <Text style={styles.optionCheck}>✓</Text> : null}
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10, marginTop: 6 },
  body: { color: '#5f6368', fontSize: 15, lineHeight: 22 },
  button: { alignItems: 'center', backgroundColor: '#1f2933', borderRadius: 12, flex: 1, justifyContent: 'center', minHeight: 50 },
  buttonWithCancel: { flex: 2 },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  cancelButton: { alignItems: 'center', borderColor: '#bdc5c1', borderRadius: 12, borderWidth: 1, flex: 1, justifyContent: 'center', minHeight: 50 },
  cancelText: { color: '#405049', fontWeight: '700' },
  disabled: { opacity: 0.55 },
  error: { color: '#b42318', fontSize: 14 },
  field: { gap: 7 },
  form: { gap: 14 },
  input: { backgroundColor: '#ffffff', borderColor: '#c9ced3', borderRadius: 12, borderWidth: 1, fontSize: 16, minHeight: 48, paddingHorizontal: 14 },
  intro: { gap: 8, paddingTop: 8 },
  label: { color: '#303840', fontSize: 14, fontWeight: '600' },
  modalBackdrop: { backgroundColor: 'rgba(18, 27, 23, 0.45)', flex: 1, justifyContent: 'flex-end' },
  notes: { minHeight: 110, paddingTop: 12 },
  optionCheck: { color: '#2f6651', fontSize: 16, fontWeight: '800' },
  optionRow: { alignItems: 'center', borderBottomColor: '#e8eae7', borderBottomWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 4 },
  optionSheet: { alignSelf: 'center', backgroundColor: '#f8f7f3', borderTopLeftRadius: 22, borderTopRightRadius: 22, maxWidth: 560, paddingBottom: 24, paddingHorizontal: 20, width: '100%' },
  optionText: { color: '#293630', fontSize: 16 },
  placeholder: { color: '#8a918e' },
  pressed: { opacity: 0.82 },
  select: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#c9ced3', borderRadius: 12, borderWidth: 1, flexDirection: 'row', justifyContent: 'space-between', minHeight: 48, paddingHorizontal: 14 },
  selectIcon: { alignItems: 'center', height: 28, justifyContent: 'center', width: 28 },
  selectText: { color: '#27342f', fontSize: 16 },
  sheetHandle: { alignSelf: 'center', backgroundColor: '#c6ccc8', borderRadius: 2, height: 4, marginBottom: 14, marginTop: 10, width: 38 },
  sheetTitle: { color: '#1f2c28', fontSize: 19, fontWeight: '800', marginBottom: 5 },
  title: { color: '#1f2933', fontSize: 26, fontWeight: '700' },
});
