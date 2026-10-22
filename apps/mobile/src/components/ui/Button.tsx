import { ActivityIndicator, Pressable, StyleSheet, View, type PressableProps } from 'react-native';

import { colors, fonts, radii, spacing, touchTarget } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'accent' | 'onDark';

export interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: Variant;
  icon?: IconName;
  trailingIcon?: IconName;
  loading?: boolean;
  size?: 'md' | 'sm';
  fullWidth?: boolean;
}

const palette: Record<Variant, { bg: string; fg: string; border: string; pressed: string }> = {
  primary: { bg: colors.navy900, fg: colors.white, border: colors.navy900, pressed: colors.navy700 },
  accent: { bg: colors.teal600, fg: colors.white, border: colors.teal600, pressed: colors.teal700 },
  secondary: { bg: colors.teal50, fg: colors.teal700, border: colors.teal100, pressed: colors.teal100 },
  outline: { bg: colors.surface, fg: colors.navy900, border: colors.borderStrong, pressed: colors.surfaceMuted },
  ghost: { bg: 'transparent', fg: colors.teal700, border: 'transparent', pressed: colors.teal50 },
  /** For dark (navy) backgrounds such as the home hero. */
  onDark: { bg: 'transparent', fg: colors.white, border: 'rgba(255,255,255,0.55)', pressed: colors.navy700 },
};

export function Button({
  label,
  variant = 'primary',
  icon,
  trailingIcon,
  loading,
  disabled,
  size = 'md',
  fullWidth,
  accessibilityLabel,
  ...rest
}: ButtonProps) {
  const p = palette[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: !!isDisabled, busy: !!loading }}
      disabled={isDisabled}
      hitSlop={size === 'sm' ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        size === 'sm' ? styles.sm : styles.md,
        { backgroundColor: pressed ? p.pressed : p.bg, borderColor: p.border },
        fullWidth && styles.fullWidth,
        isDisabled && styles.disabled,
      ]}
      {...rest}>
      {loading ? (
        <ActivityIndicator color={p.fg} size="small" />
      ) : (
        <View style={styles.row}>
          {icon ? <Icon name={icon} size={size === 'sm' ? 16 : 20} color={p.fg} /> : null}
          <AppText
            variant={size === 'sm' ? 'smallStrong' : 'bodyStrong'}
            color={p.fg}
            style={{ fontFamily: fonts.bold }}
            numberOfLines={1}>
            {label}
          </AppText>
          {trailingIcon ? <Icon name={trailingIcon} size={size === 'sm' ? 16 : 20} color={p.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  md: { minHeight: touchTarget, paddingHorizontal: spacing.xl },
  sm: { minHeight: 36, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  fullWidth: { alignSelf: 'stretch' },
  disabled: { opacity: 0.45 },
});
