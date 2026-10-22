import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { colors, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

type Tone = 'info' | 'warning' | 'offline' | 'success' | 'review';

const TONE: Record<Tone, { bg: string; fg: string; border: string; icon: IconName }> = {
  info: { bg: colors.infoBg, fg: colors.info, border: '#C9DAF2', icon: 'information-outline' },
  warning: { bg: colors.warningBg, fg: colors.warning, border: '#F6D9A1', icon: 'alert-outline' },
  review: { bg: colors.reviewBg, fg: colors.review, border: '#F7C9AE', icon: 'alert-outline' },
  offline: { bg: colors.surfaceMuted, fg: colors.ink700, border: colors.border, icon: 'cloud-off-outline' },
  success: { bg: colors.successBg, fg: colors.success, border: '#BFE3CF', icon: 'check-circle-outline' },
};

export function Banner({
  tone = 'info',
  title,
  children,
  icon,
  onPress,
  action,
}: {
  tone?: Tone;
  title?: string;
  children?: ReactNode;
  icon?: IconName;
  onPress?: () => void;
  action?: ReactNode;
}) {
  const t = TONE[tone];
  const body = (
    <View style={[styles.banner, { backgroundColor: t.bg, borderColor: t.border }]}>
      <Icon name={icon ?? t.icon} size={20} color={t.fg} />
      <View style={styles.text}>
        {title ? (
          <AppText variant="smallStrong" color={t.fg}>
            {title}
          </AppText>
        ) : null}
        {typeof children === 'string' ? (
          <AppText variant="small" color={colors.ink700}>
            {children}
          </AppText>
        ) : (
          children
        )}
        {action}
      </View>
      {onPress ? <Icon name="chevron-right" size={20} color={t.fg} /> : null}
    </View>
  );
  if (!onPress) return <View accessibilityRole="summary">{body}</View>;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title, typeof children === 'string' ? children : ''].filter(Boolean).join('. ')}
      onPress={onPress}
      style={({ pressed }) => pressed && { opacity: 0.85 }}>
      {body}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  text: { flex: 1, gap: 2 },
});
