import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { EssentialForm } from '@/features/essentials/essential-form';
import {
  deleteEssential,
  getEssential,
  type HomeEssential,
  saveEssential,
} from '@/features/essentials/essential-repository';

export default function EditEssentialScreen() {
  const db = useSQLiteContext();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [essential, setEssential] = useState<HomeEssential>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    getEssential(db, id).then((value) => {
      if (value) setEssential(value);
      else router.replace('/essentials' as Href);
    });
  }, [db, id]);

  if (!essential) return <View style={styles.center}><ActivityIndicator size="large" /></View>;

  function remove() {
    if (!essential) return;
    const current = essential;
    Alert.alert('Delete essential?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await deleteEssential(db, current.id);
          router.replace('/essentials' as Href);
        },
      },
    ]);
  }

  return (
    <EssentialForm
      error={error}
      initial={essential}
      isEditing
      onCancel={() => router.back()}
      onDelete={remove}
      onSubmit={async (input) => {
        setSaving(true);
        setError(undefined);
        try {
          await saveEssential(db, essential.homeId, input, essential.id);
          router.replace('/essentials' as Href);
        } catch (caught) {
          setError(caught instanceof Error ? caught.message : 'Could not save this essential.');
          setSaving(false);
        }
      }}
      saving={saving}
    />
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
