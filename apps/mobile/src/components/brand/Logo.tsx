import Svg, { Circle, Rect } from 'react-native-svg';
import { StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui';
import { colors } from '@/theme/tokens';

/** The Toll-E mark: a boom gate on a navy tile. */
export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <Rect width={64} height={64} rx={16} fill={colors.navy900} />
      <Rect x={14} y={16} width={8} height={30} rx={2.5} fill={colors.white} />
      <Rect x={18} y={18} width={36} height={8} rx={4} fill={colors.teal500} />
      <Rect x={30} y={18} width={6} height={8} fill={colors.white} />
      <Rect x={42} y={18} width={6} height={8} fill={colors.white} />
      <Circle cx={18} cy={22} r={5.5} fill={colors.amber500} />
      <Rect x={10} y={44} width={16} height={4} rx={2} fill={colors.teal100} />
    </Svg>
  );
}

export function Logo({ size = 36, inverse = false }: { size?: number; inverse?: boolean }) {
  return (
    <View style={styles.row} accessible accessibilityRole="header" accessibilityLabel="Toll-E">
      <LogoMark size={size} />
      <AppText variant="title" color={inverse ? colors.white : colors.navy900} style={styles.word}>
        Toll
        <AppText variant="title" color={inverse ? colors.teal100 : colors.teal600} style={styles.word}>
          -E
        </AppText>
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  word: { fontSize: 24, lineHeight: 28, letterSpacing: -0.6 },
});
