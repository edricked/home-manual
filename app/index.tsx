import { Redirect } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getHome } from '@/features/home/home-repository';

export default function StartScreen() {
  const db = useSQLiteContext();
  const [destination, setDestination] = useState<'/onboarding' | '/items'>();
  const [error, setError] = useState<string>();

  useEffect(() => {
    getHome(db)
      .then((home) => setDestination(home ? '/items' : '/onboarding'))
      .catch(() => setError('Home Manual could not open its local database.'));
  }, [db]);

  if (destination) {
    return <Redirect href={destination} />;
  }

  return (
    <View style={styles.container}>
      {error ? <Text style={styles.error}>{error}</Text> : <ActivityIndicator size="large" />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  error: {
    color: '#b42318',
    textAlign: 'center',
  },
});
