import type { Notice } from '@toll-e/core';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { colors, radii, spacing } from '@/theme/tokens';

const TONE = {
  warning: { bg: colors.warningBg, fg: colors.warning, border: '#F6D9A1', icon: 'alert-outline' },
  info: { bg: colors.infoBg, fg: colors.info, border: '#C9DAF2', icon: 'information-outline' },
} as const;

/** Notices as one-line rows: the title always shows, the full text when tapped. */
export function Notices({ notices }: { notices: Notice[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (notices.length === 0) return null;
  return (
    <View style={styles.list}>
      {notices.map((n) => {
        const expanded = open === n.id;
        const t = TONE[n.severity === 'warning' ? 'warning' : 'info'];
        return (
          <Pressable
            key={n.id}
            accessibilityRole="button"
            accessibilityLabel={n.title}
            accessibilityHint={expanded ? 'Hides the notice text' : 'Shows the notice text'}
            accessibilityState={{ expanded }}
            onPress={() => setOpen(expanded ? null : n.id)}
            style={({ pressed }) => [
              styles.row,
              { backgroundColor: t.bg, borderColor: t.border },
              pressed && { opacity: 0.85 },
            ]}>
            <View style={styles.head}>
              <Icon name={t.icon} size={18} color={t.fg} />
              <AppText variant="smallStrong" color={t.fg} style={styles.title}>
                {n.title}
              </AppText>
              <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={20} color={t.fg} />
            </View>
            {expanded ? (
              <AppText variant="small" color={colors.ink700} style={styles.body}>
                {n.body}
              </AppText>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.xs },
  row: {
    borderWidth: 1,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 28 },
  title: { flex: 1 },
  body: { marginTop: spacing.xs, marginLeft: 18 + spacing.sm },
});
