import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { type Href, router, Stack } from 'expo-router';
import { SQLiteProvider } from 'expo-sqlite';
import { type PropsWithChildren, Suspense, useEffect, useState } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { migrateDatabase } from '@/db/migrations';
import { configureReminderNavigation } from '@/features/reminders/reminder-service';

function DatabaseFallback() {
  return (
    <View style={styles.fallback}>
      <ActivityIndicator size="large" />
    </View>
  );
}

function WebDatabaseGate({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<'checking' | 'ready' | 'blocked'>(
    Platform.OS === 'web' ? 'checking' : 'ready',
  );
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (Platform.OS !== 'web' || !navigator.locks) {
      setStatus('ready');
      return;
    }

    let release: (() => void) | undefined;
    let active = true;

    navigator.locks.request('home-manual-sqlite', { ifAvailable: true }, async (lock) => {
      if (!active) return;
      if (!lock) {
        setStatus('blocked');
        return;
      }
      setStatus('ready');
      await new Promise<void>((resolve) => {
        release = resolve;
      });
    });

    return () => {
      active = false;
      release?.();
    };
  }, [attempt]);

  if (status === 'ready') return children;
  if (status === 'checking') return <DatabaseFallback />;

  return (
    <View style={styles.lockScreen}>
      <View style={styles.lockIcon}><Text style={styles.lockIconText}>⌂</Text></View>
      <Text style={styles.lockTitle}>Home Manual is open in another tab</Text>
      <Text style={styles.lockBody}>
        The browser preview can use its local database in one tab at a time. Close the other Home Manual tab, then try again.
      </Text>
      <Pressable accessibilityRole="button" onPress={() => {
        setStatus('checking');
        setAttempt((value) => value + 1);
      }} style={styles.retryButton}>
        <Text style={styles.retryText}>Try again</Text>
      </Pressable>
    </View>
  );
}

export default function RootLayout() {
  const colorScheme = useColorScheme();

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    configureReminderNavigation((url) => router.push(url as Href)).then((value) => {
      cleanup = value;
    });
    return () => cleanup?.();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
        <WebDatabaseGate>
          <Suspense fallback={<DatabaseFallback />}>
            <SQLiteProvider databaseName="home-manual.db" onInit={migrateDatabase} useSuspense>
              <Stack
                screenOptions={{
                  headerBackButtonDisplayMode: 'minimal',
                  headerTitleStyle: { fontWeight: '600' },
                }}>
                <Stack.Screen name="index" options={{ headerShown: false }} />
                <Stack.Screen name="onboarding" options={{ title: 'Create your home' }} />
                <Stack.Screen name="items/index" options={{ title: 'Home Manual' }} />
                <Stack.Screen name="items/new" options={{ title: 'Add item', presentation: 'modal' }} />
                <Stack.Screen name="items/[id]" options={{ title: 'Item' }} />
                <Stack.Screen name="documents/index" options={{ title: 'Documents' }} />
                <Stack.Screen name="documents/new" options={{ title: 'Add document', presentation: 'modal' }} />
                <Stack.Screen name="repairs/new" options={{ title: 'Record repair', presentation: 'modal' }} />
                <Stack.Screen name="search" options={{ title: 'Search' }} />
                <Stack.Screen name="maintenance" options={{ title: 'Maintenance' }} />
                <Stack.Screen name="maintenance/new" options={{ title: 'Add maintenance', presentation: 'modal' }} />
                <Stack.Screen name="maintenance/[id]" options={{ title: 'Maintenance task' }} />
                <Stack.Screen name="essentials/index" options={{ title: 'Home Essentials' }} />
                <Stack.Screen name="essentials/new" options={{ title: 'Add essential', presentation: 'modal' }} />
                <Stack.Screen name="essentials/[id]" options={{ title: 'Edit essential', presentation: 'modal' }} />
                <Stack.Screen name="more" options={{ title: 'More' }} />
              </Stack>
            </SQLiteProvider>
          </Suspense>
        </WebDatabaseGate>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  fallback: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  lockBody: { color: '#67716d', fontSize: 15, lineHeight: 22, maxWidth: 430, textAlign: 'center' },
  lockIcon: { alignItems: 'center', backgroundColor: '#e5f0ea', borderRadius: 28, height: 56, justifyContent: 'center', marginBottom: 4, width: 56 },
  lockIconText: { color: '#2f6651', fontSize: 25, fontWeight: '800' },
  lockScreen: { alignItems: 'center', backgroundColor: '#f8f7f3', flex: 1, gap: 11, justifyContent: 'center', padding: 28 },
  lockTitle: { color: '#1f2c28', fontSize: 23, fontWeight: '800', textAlign: 'center' },
  retryButton: { alignItems: 'center', backgroundColor: '#263b33', borderRadius: 12, justifyContent: 'center', marginTop: 8, minHeight: 48, paddingHorizontal: 20 },
  retryText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
