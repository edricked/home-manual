import { router, usePathname } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

const destinations = [
  { label: 'Home', path: '/items', icon: '⌂' },
  { label: 'Search', path: '/search', icon: '⌕' },
  { label: 'Add', path: '/items/new', icon: '+' },
  { label: 'Maintain', path: '/maintenance', icon: '✓' },
  { label: 'More', path: '/more', icon: '•••' },
] as const;

export function BottomNav() {
  const pathname = usePathname();

  return (
    <View accessibilityRole="tablist" style={styles.nav}>
      {destinations.map((destination) => {
        const selected =
          destination.path === '/items'
            ? pathname === '/items' || pathname === '/'
            : pathname.startsWith(destination.path);
        return (
          <Pressable
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            key={destination.path}
            onPress={() => router.navigate(destination.path)}
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}>
            <Text style={[styles.icon, selected && styles.selected]}>{destination.icon}</Text>
            <Text style={[styles.label, selected && styles.selected]}>{destination.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  icon: { color: '#68737d', fontSize: 21, lineHeight: 23 },
  item: { alignItems: 'center', flex: 1, gap: 1, justifyContent: 'center', minHeight: 58 },
  label: { color: '#68737d', fontSize: 11 },
  nav: { backgroundColor: '#ffffff', borderTopColor: '#dfe3e6', borderTopWidth: 1, flexDirection: 'row' },
  pressed: { opacity: 0.6 },
  selected: { color: '#1f2933', fontWeight: '700' },
});
