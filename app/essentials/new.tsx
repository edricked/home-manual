import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { EssentialForm } from '@/features/essentials/essential-form';
import {
  essentialCategories,
  type EssentialCategory,
  saveEssential,
} from '@/features/essentials/essential-repository';
import { getHome, type Home } from '@/features/home/home-repository';

export default function NewEssentialScreen() {
  const db = useSQLiteContext();
  const params = useLocalSearchParams<{ category?: string; title?: string }>();
  const [home, setHome] = useState<Home>();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const category = essentialCategories.includes(params.category as EssentialCategory)
    ? params.category as EssentialCategory
    : 'Household info';

  useEffect(() => {
    getHome(db).then((value) => value ? setHome(value) : router.replace('/onboarding'));
  }, [db]);

  if (!home) return <View style={styles.center}><ActivityIndicator size="large" /></View>;

  return (
    <EssentialForm
      error={error}
      initial={{
        category,
        title: params.title ?? '',
        value: '',
        notes: '',
        isSensitive: category === 'Wi-Fi',
      }}
      onCancel={() => router.back()}
      onSubmit={async (input) => {
        setSaving(true);
        setError(undefined);
        try {
          await saveEssential(db, home.id, input);
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
