import { StyleSheet, View } from 'react-native';

import { TRUST_LABEL, type Trust } from '@toll-e/core';

import { colors, radii, spacing } from '@/theme/tokens';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type BadgeTone = 'success' | 'warning' | 'review' | 'neutral' | 'info' | 'brand' | 'danger' | 'outlineWarning';

const TONES: Record<BadgeTone, { bg: string; fg: string; border: string }> = {
  success: { bg: colors.successBg, fg: colors.success, border: colors.successBg },
  warning: { bg: colors.warningBg, fg: colors.warning, border: colors.warningBg },
  outlineWarning: { bg: colors.surface, fg: colors.warning, border: colors.amber500 },
  review: { bg: colors.reviewBg, fg: colors.review, border: colors.reviewBg },
  neutral: { bg: colors.surfaceMuted, fg: colors.ink700, border: colors.border },
  info: { bg: colors.infoBg, fg: colors.info, border: colors.infoBg },
  brand: { bg: colors.teal50, fg: colors.teal700, border: colors.teal100 },
  danger: { bg: colors.dangerBg, fg: colors.danger, border: colors.dangerBg },
};

export function Badge({
  label,
  tone = 'neutral',
  icon,
  accessibilityLabel,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: IconName;
  accessibilityLabel?: string;
}) {
  const t = TONES[tone];
  return (
    <View
      accessible
      accessibilityLabel={accessibilityLabel ?? label}
      style={[styles.badge, { backgroundColor: t.bg, borderColor: t.border }]}>
      {icon ? <Icon name={icon} size={13} color={t.fg} /> : null}
      <AppText variant="smallStrong" color={t.fg} numberOfLines={2} style={styles.text}>
        {label}
      </AppText>
    </View>
  );
}

const TRUST_STYLE: Record<Trust | 'unavailable', { tone: BadgeTone; icon: IconName; label: string }> = {
  confirmed: { tone: 'success', icon: 'check-decagram', label: TRUST_LABEL.confirmed },
  stale: { tone: 'warning', icon: 'clock-alert-outline', label: 'May be out of date' },
  unverified: { tone: 'outlineWarning', icon: 'help-circle-outline', label: TRUST_LABEL.unverified },
  under_review: { tone: 'review', icon: 'alert-outline', label: TRUST_LABEL.under_review },
  illustrative: { tone: 'neutral', icon: 'flask-outline', label: TRUST_LABEL.illustrative },
  unavailable: { tone: 'neutral', icon: 'minus-circle-outline', label: 'Not available' },
};

/** The single, consistent indicator of how far a price can be trusted. */
export function TrustBadge({ trust, compact }: { trust: Trust | 'unavailable'; compact?: boolean }) {
  const s = TRUST_STYLE[trust];
  return (
    <Badge
      label={compact && trust === 'confirmed' ? 'Verified' : s.label}
      tone={s.tone}
      icon={s.icon}
      accessibilityLabel={`Tariff status: ${s.label}`}
    />
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.pill,
    borderWidth: 1,
  },
  // Long labels wrap inside the badge instead of overflowing narrow screens.
  text: { fontSize: 12, lineHeight: 16, flexShrink: 1 },
});
