import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Screen } from '@/components/screen';
import { createHome } from '@/features/home/home-repository';

export default function OnboardingScreen() {
  const db = useSQLiteContext();
  const [name, setName] = useState('');
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);

  async function submit() {
    setSaving(true);
    setError(undefined);
    try {
      await createHome(db, { name });
      router.replace('/items');
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not create the home.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Screen>
      <View style={styles.intro}>
        <Text style={styles.eyebrow}>PRIVATE AND OFFLINE</Text>
        <Text style={styles.title}>What should we call your home?</Text>
        <Text style={styles.body}>
          This name stays on your phone. You can change it later.
        </Text>
      </View>

      <View style={styles.form}>
        <Text style={styles.label}>Home name</Text>
        <TextInput
          accessibilityLabel="Home name"
          autoFocus
          onChangeText={setName}
          placeholder="Maple House"
          returnKeyType="done"
          style={styles.input}
          value={name}
          onSubmitEditing={submit}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        <Pressable
          accessibilityRole="button"
          disabled={saving}
          onPress={submit}
          style={({ pressed }) => [styles.button, pressed && styles.pressed, saving && styles.disabled]}>
          <Text style={styles.buttonText}>{saving ? 'Creating…' : 'Create home'}</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { color: '#5f6368', fontSize: 16, lineHeight: 24 },
  button: { alignItems: 'center', backgroundColor: '#1f2933', borderRadius: 12, minHeight: 50, justifyContent: 'center' },
  buttonText: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  disabled: { opacity: 0.55 },
  error: { color: '#b42318', fontSize: 14 },
  eyebrow: { color: '#68737d', fontSize: 12, fontWeight: '700', letterSpacing: 1.2 },
  form: { gap: 10 },
  input: { borderColor: '#c9ced3', borderRadius: 12, borderWidth: 1, fontSize: 17, minHeight: 50, paddingHorizontal: 14 },
  intro: { gap: 10, marginTop: 36 },
  label: { fontSize: 14, fontWeight: '600' },
  pressed: { opacity: 0.82 },
  title: { color: '#1f2933', fontSize: 30, fontWeight: '700', lineHeight: 36 },
});
