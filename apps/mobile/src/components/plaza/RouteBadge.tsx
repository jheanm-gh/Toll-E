import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors, radii } from '@/theme/tokens';

/** Road shield, styled after South African national route markers (navy on white). */
export function RouteBadge({ route, size = 'md' }: { route: string; size?: 'sm' | 'md' }) {
  return (
    <View accessible accessibilityLabel={`Route ${route}`} style={[styles.badge, size === 'sm' && styles.sm]}>
      <AppText variant="smallStrong" color={colors.navy900} style={size === 'sm' ? styles.textSm : styles.text}>
        {route}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    minWidth: 38,
    paddingHorizontal: 6,
    height: 24,
    borderRadius: radii.sm - 2,
    borderWidth: 2,
    borderColor: colors.navy900,
    backgroundColor: colors.white,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sm: { minWidth: 32, height: 20, borderWidth: 1.5 },
  text: { fontSize: 12.5, lineHeight: 16 },
  textSm: { fontSize: 11, lineHeight: 14 },
});
