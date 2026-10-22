import { STANDARD_CLASSES, STANDARD_CLASS_LABEL, type StandardClassId } from '@toll-e/core';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon, type IconName } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/tokens';

const ICON: Record<StandardClassId, IconName> = {
  class1: 'car-side',
  class2: 'truck-outline',
  class3: 'truck',
  class4: 'truck-trailer',
};

export function ClassPicker({ value, onChange }: { value: StandardClassId; onChange: (c: StandardClassId) => void }) {
  return (
    <View style={styles.grid} accessibilityRole="radiogroup" accessibilityLabel="Vehicle class">
      {STANDARD_CLASSES.map((c) => {
        const active = c === value;
        const l = STANDARD_CLASS_LABEL[c];
        return (
          <Pressable
            key={c}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            accessibilityLabel={`${l.label}, ${l.short}: ${l.detail}`}
            onPress={() => onChange(c)}
            style={({ pressed }) => [styles.option, active && styles.active, pressed && { opacity: 0.85 }]}>
            <Icon name={ICON[c]} size={22} color={active ? colors.white : colors.navy900} />
            <AppText variant="smallStrong" color={active ? colors.white : colors.navy900}>
              {l.label}
            </AppText>
            <AppText
              variant="small"
              color={active ? colors.teal100 : colors.ink500}
              numberOfLines={2}
              style={styles.detail}>
              {l.short}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 84,
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    gap: 2,
  },
  active: { backgroundColor: colors.navy900, borderColor: colors.navy900 },
  detail: { fontSize: 12, lineHeight: 16 },
});
