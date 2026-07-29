import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { ItemForm } from '@/features/items/item-form';
import { createItem } from '@/features/items/item-repository';
import { type ItemInput } from '@/features/items/item-schema';
import { getHome, type Home } from '@/features/home/home-repository';

export default function NewItemScreen() {
  const db = useSQLiteContext();
  const [home, setHome] = useState<Home>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    getHome(db).then((value) => {
      if (value) setHome(value);
      else router.replace('/onboarding');
    });
  }, [db]);

  async function submit(input: ItemInput) {
    if (!home) return;
    setError(undefined);
    try {
      const item = await createItem(db, home.id, input);
      router.replace({ pathname: '/items/[id]', params: { id: item.id } });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save the item.');
      throw caught;
    }
  }

  if (!home) return <View style={styles.center}><ActivityIndicator size="large" /></View>;
  return <ItemForm error={error} onCancel={() => router.replace('/items')} onSubmit={submit} submitLabel="Add item" />;
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', flex: 1, justifyContent: 'center' },
});
