import { StyleSheet, View } from 'react-native';

import { colors, spacing } from '@/theme/tokens';

export function Divider({ inset = 0, spaced = false }: { inset?: number; spaced?: boolean }) {
  return <View style={[styles.line, { marginLeft: inset }, spaced && styles.spaced]} />;
}

const styles = StyleSheet.create({
  line: { height: StyleSheet.hairlineWidth, backgroundColor: colors.borderStrong },
  spaced: { marginVertical: spacing.md },
});
