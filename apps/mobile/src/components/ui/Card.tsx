import { Pressable, StyleSheet, View, type ViewProps } from 'react-native';

import { colors, elevation, radii, spacing } from '@/theme/tokens';

export interface CardProps extends ViewProps {
  onPress?: () => void;
  accessibilityLabel?: string;
  tone?: 'default' | 'muted' | 'brand';
  padded?: boolean;
}

export function Card({
  onPress,
  tone = 'default',
  padded = true,
  style,
  children,
  accessibilityLabel,
  ...rest
}: CardProps) {
  const toneStyle = tone === 'brand' ? styles.brand : tone === 'muted' ? styles.muted : styles.default;
  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        onPress={onPress}
        style={({ pressed }) => [styles.base, toneStyle, padded && styles.padded, pressed && styles.pressed, style]}
        {...rest}>
        {children}
      </Pressable>
    );
  }
  return (
    <View style={[styles.base, toneStyle, padded && styles.padded, style]} {...rest}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: { borderRadius: radii.lg, borderWidth: 1 },
  default: { backgroundColor: colors.surface, borderColor: colors.border, ...elevation.card },
  muted: { backgroundColor: colors.surfaceMuted, borderColor: colors.border },
  brand: { backgroundColor: colors.navy900, borderColor: colors.navy900, ...elevation.card },
  padded: { padding: spacing.lg },
  pressed: { opacity: 0.85 },
});
