import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radii, spacing, touchTarget } from '@/theme/tokens';

import { AppText } from './AppText';
import { Button } from './Button';
import { Icon } from './Icon';

export interface SheetOption<T extends string> {
  value: T;
  label: string;
  caption?: string;
}

/** A bottom sheet with a single-choice list. Choosing an option closes it. */
export function OptionSheet<T extends string>({
  visible,
  title,
  options,
  selected,
  onSelect,
  onClose,
  footnote,
}: {
  visible: boolean;
  title: string;
  options: SheetOption<T>[];
  selected: T;
  onSelect: (value: T) => void;
  onClose: () => void;
  footnote?: string;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <AppText variant="heading" accessibilityRole="header">
          {title}
        </AppText>
        <ScrollView style={styles.list}>
          {options.map((o) => {
            const isSelected = o.value === selected;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                accessibilityLabel={o.caption ? `${o.label}. ${o.caption}` : o.label}
                onPress={() => {
                  onSelect(o.value);
                  onClose();
                }}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfaceMuted }]}>
                <Icon
                  name={isSelected ? 'radiobox-marked' : 'radiobox-blank'}
                  size={22}
                  color={isSelected ? colors.teal700 : colors.ink400}
                />
                <View style={styles.optionText}>
                  <AppText variant="bodyStrong">{o.label}</AppText>
                  {o.caption ? (
                    <AppText variant="small" color={colors.ink500}>
                      {o.caption}
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        {footnote ? (
          <AppText variant="small" color={colors.ink500}>
            {footnote}
          </AppText>
        ) : null}
        <Button label="Cancel" variant="outline" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    maxHeight: '80%',
  },
  list: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: touchTarget + 4,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  optionText: { flex: 1, gap: 2 },
});
