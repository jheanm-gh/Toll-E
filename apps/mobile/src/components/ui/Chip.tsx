import { Pressable, StyleSheet } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export function Chip({
  label,
  selected,
  onPress,
  icon,
  menu,
  accessibilityLabel,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  /** Opens a list of choices: shows a down arrow after the label. */
  menu?: boolean;
  accessibilityLabel?: string;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={menu ? 'Opens a list of choices' : undefined}
      onPress={onPress}
      hitSlop={{ top: 6, bottom: 6 }}
      style={({ pressed }) => [
        styles.chip,
        selected ? styles.selected : styles.unselected,
        pressed && { opacity: 0.8 },
      ]}>
      {icon ? <Icon name={icon} size={15} color={selected ? colors.white : colors.ink700} /> : null}
      <AppText variant="smallStrong" color={selected ? colors.white : colors.ink700}>
        {label}
      </AppText>
      {menu ? <Icon name="chevron-down" size={16} color={selected ? colors.white : colors.ink700} /> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  selected: { backgroundColor: colors.navy900, borderColor: colors.navy900 },
  unselected: { backgroundColor: colors.surface, borderColor: colors.borderStrong },
});
