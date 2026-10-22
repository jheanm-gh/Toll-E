import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PlazaDirectory } from '@/components/plaza/PlazaDirectory';
import { colors } from '@/theme/tokens';

/** Full plaza directory, reachable from Home search and links. */
export default function PlazaDirectoryScreen() {
  const { q, near } = useLocalSearchParams<{ q?: string; near?: string }>();
  return (
    <View style={styles.wrap}>
      <PlazaDirectory initialQuery={q ?? ''} initialNear={near === '1'} />
    </View>
  );
}

const styles = StyleSheet.create({ wrap: { flex: 1, backgroundColor: colors.background } });
