import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { AppFrame } from '@/components/app-frame';
import { getHome, type Home } from '@/features/home/home-repository';
import {
  searchHomeManual,
  type SearchResult,
  type SearchResultKind,
} from '@/features/search/search-repository';

const sections: { kind: SearchResultKind; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { kind: 'item', label: 'Items', icon: 'cube-outline' },
  { kind: 'essential', label: 'Home Essentials', icon: 'key-outline' },
  { kind: 'maintenance', label: 'Maintenance', icon: 'checkmark-circle-outline' },
  { kind: 'history', label: 'Completed maintenance', icon: 'time-outline' },
  { kind: 'repair', label: 'Repairs', icon: 'construct-outline' },
  { kind: 'document', label: 'Documents', icon: 'document-text-outline' },
];

function destinationFor(result: SearchResult) {
  if (result.kind === 'essential') {
    return { pathname: '/essentials/[id]' as const, params: { id: result.id } };
  }
  if (result.kind === 'maintenance' || result.kind === 'history') return '/maintenance' as const;
  return { pathname: '/items/[id]' as const, params: { id: result.itemId! } };
}

export default function SearchScreen() {
  const db = useSQLiteContext();
  const [home, setHome] = useState<Home>();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string>();

  useEffect(() => {
    getHome(db).then((value) => {
      if (value) setHome(value);
      else router.replace('/onboarding');
    });
  }, [db]);

  useEffect(() => {
    const term = query.trim();
    if (!home || term.length < 2) {
      setResults([]);
      setSearching(false);
      setError(undefined);
      return;
    }

    let active = true;
    setSearching(true);
    const timer = setTimeout(() => {
      searchHomeManual(db, home.id, term)
        .then((value) => {
          if (active) setResults(value);
        })
        .catch(() => {
          if (active) setError('Search could not be completed.');
        })
        .finally(() => {
          if (active) setSearching(false);
        });
    }, 220);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [db, home, query]);

  const grouped = useMemo(
    () => sections.map((section) => ({
      ...section,
      results: results.filter((result) => result.kind === section.kind),
    })).filter((section) => section.results.length > 0),
    [results],
  );

  const hasQuery = query.trim().length >= 2;

  return (
    <AppFrame>
      <View style={styles.content}>
        <View style={styles.heading}>
          <Text style={styles.eyebrow}>EVERYTHING IN ONE PLACE</Text>
          <Text style={styles.title}>Search your home</Text>
        </View>

        <View style={styles.searchBox}>
          <Ionicons color="#69766f" name="search" size={21} />
          <TextInput
            accessibilityLabel="Search your home"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            onChangeText={(value) => {
              setError(undefined);
              setQuery(value);
            }}
            onSubmitEditing={Keyboard.dismiss}
            placeholder="Appliance, shutoff, receipt, contractor…"
            placeholderTextColor="#8a9490"
            returnKeyType="search"
            style={styles.input}
            value={query}
          />
          {query ? (
            <Pressable accessibilityLabel="Clear search" accessibilityRole="button" onPress={() => setQuery('')} style={styles.clearButton}>
              <Ionicons color="#69766f" name="close-circle" size={21} />
            </Pressable>
          ) : null}
        </View>

        {searching ? <ActivityIndicator color="#2f6651" style={styles.spinner} /> : null}

        <ScrollView contentContainerStyle={styles.results} keyboardShouldPersistTaps="handled">
          {error ? (
            <View style={styles.empty}>
              <Ionicons color="#9b352f" name="alert-circle-outline" size={31} />
              <Text style={styles.error}>{error}</Text>
            </View>
          ) : !hasQuery ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Ionicons color="#2f6651" name="search-outline" size={30} /></View>
              <Text style={styles.emptyTitle}>Find anything you remember</Text>
              <Text style={styles.emptyBody}>
                Search items, model numbers, essentials, maintenance, repairs, contractors, and documents.
              </Text>
            </View>
          ) : !searching && grouped.length === 0 ? (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}><Ionicons color="#2f6651" name="file-tray-outline" size={29} /></View>
              <Text style={styles.emptyTitle}>No results for “{query.trim()}”</Text>
              <Text style={styles.emptyBody}>Try a shorter word, a room name, or part of a model number.</Text>
            </View>
          ) : (
            grouped.map((section) => (
              <View key={section.kind} style={styles.section}>
                <View style={styles.sectionHeading}>
                  <Ionicons color="#587066" name={section.icon} size={17} />
                  <Text style={styles.sectionLabel}>{section.label.toUpperCase()}</Text>
                  <Text style={styles.count}>{section.results.length}</Text>
                </View>
                <View style={styles.resultCard}>
                  {section.results.map((result, index) => (
                    <Pressable
                      accessibilityRole="button"
                      key={`${result.kind}-${result.id}`}
                      onPress={() => router.push(destinationFor(result))}
                      style={({ pressed }) => [
                        styles.result,
                        index === section.results.length - 1 && styles.lastResult,
                        pressed && styles.pressed,
                      ]}>
                      <View style={styles.resultText}>
                        <Text style={styles.resultTitle}>{result.title}</Text>
                        <Text numberOfLines={2} style={styles.meta}>
                          {result.isSensitive ? 'Hidden value' : result.subtitle.replace(/^ · | · $/g, '').replace(/ ·  · /g, ' · ')}
                        </Text>
                      </View>
                      <Ionicons color="#839089" name="chevron-forward" size={20} />
                    </Pressable>
                  ))}
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </View>
    </AppFrame>
  );
}

const styles = StyleSheet.create({
  clearButton: { alignItems: 'center', height: 40, justifyContent: 'center', width: 36 },
  content: { backgroundColor: '#f8f7f3', flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  count: { backgroundColor: '#e4ece8', borderRadius: 10, color: '#476257', fontSize: 11, fontWeight: '800', overflow: 'hidden', paddingHorizontal: 7, paddingVertical: 2 },
  empty: { alignItems: 'center', gap: 9, paddingHorizontal: 24, paddingTop: 64 },
  emptyBody: { color: '#68736f', fontSize: 14, lineHeight: 21, maxWidth: 340, textAlign: 'center' },
  emptyIcon: { alignItems: 'center', backgroundColor: '#e5f0ea', borderRadius: 29, height: 58, justifyContent: 'center', marginBottom: 3, width: 58 },
  emptyTitle: { color: '#26332f', fontSize: 20, fontWeight: '800', textAlign: 'center' },
  error: { color: '#9b352f', fontSize: 14, textAlign: 'center' },
  eyebrow: { color: '#2f6651', fontSize: 11, fontWeight: '800', letterSpacing: 1.1 },
  heading: { marginBottom: 15 },
  input: { color: '#1f2c28', flex: 1, fontSize: 16, minHeight: 50, paddingVertical: 10 },
  lastResult: { borderBottomWidth: 0 },
  meta: { color: '#74807b', fontSize: 13, lineHeight: 18, marginTop: 3 },
  pressed: { opacity: 0.65 },
  result: { alignItems: 'center', borderBottomColor: '#e6e9e7', borderBottomWidth: 1, flexDirection: 'row', minHeight: 68, paddingHorizontal: 14, paddingVertical: 10 },
  resultCard: { backgroundColor: '#fff', borderColor: '#e0e4e1', borderRadius: 15, borderWidth: 1, overflow: 'hidden' },
  results: { paddingBottom: 34 },
  resultText: { flex: 1 },
  resultTitle: { color: '#27342f', fontSize: 16, fontWeight: '700' },
  searchBox: { alignItems: 'center', backgroundColor: '#fff', borderColor: '#bfcac5', borderRadius: 14, borderWidth: 1, flexDirection: 'row', gap: 7, paddingHorizontal: 13 },
  section: { gap: 8, marginTop: 20 },
  sectionHeading: { alignItems: 'center', flexDirection: 'row', gap: 7 },
  sectionLabel: { color: '#53615c', fontSize: 11, fontWeight: '800', letterSpacing: 0.8 },
  spinner: { marginTop: 14 },
  title: { color: '#1f2c28', fontSize: 29, fontWeight: '800', marginTop: 3 },
});
