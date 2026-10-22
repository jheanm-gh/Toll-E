import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { colors, fonts, radii, spacing, touchTarget } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export interface TextFieldProps extends TextInputProps {
  label?: string;
  icon?: IconName;
  onClear?: () => void;
  error?: string | null;
  hint?: string;
}

export function TextField({ label, icon, onClear, error, hint, style, value, multiline, ...rest }: TextFieldProps) {
  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="smallStrong" color={colors.ink700}>
          {label}
        </AppText>
      ) : null}
      <View style={[styles.field, multiline && styles.multiline, error ? styles.fieldError : null]}>
        {icon ? <Icon name={icon} size={20} color={colors.ink500} /> : null}
        <TextInput
          value={value}
          placeholderTextColor={colors.ink400}
          multiline={multiline}
          accessibilityLabel={rest.accessibilityLabel ?? label ?? rest.placeholder}
          style={[styles.input, multiline && styles.inputMultiline, style]}
          {...rest}
        />
        {onClear && value ? (
          <Pressable accessibilityRole="button" accessibilityLabel="Clear" onPress={onClear} hitSlop={10}>
            <Icon name="close-circle" size={18} color={colors.ink400} />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <AppText variant="small" color={colors.danger}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText variant="small" color={colors.ink500}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  field: {
    minHeight: touchTarget,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  multiline: { alignItems: 'flex-start', paddingVertical: spacing.sm },
  fieldError: { borderColor: colors.danger },
  input: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink900, paddingVertical: spacing.sm },
  inputMultiline: { minHeight: 110, textAlignVertical: 'top' },
});
