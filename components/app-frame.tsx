import { type PropsWithChildren } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BottomNav } from './bottom-nav';

export function AppFrame({ children }: PropsWithChildren) {
  return (
    <SafeAreaView edges={['bottom']} style={styles.safeArea}>
      <View style={styles.content}>{children}</View>
      <BottomNav />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1 },
  safeArea: { backgroundColor: '#f8f7f3', flex: 1 },
});
