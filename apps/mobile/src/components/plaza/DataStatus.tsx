import { formatLongDate, saLocalDate } from '@toll-e/core';
import { StyleSheet, View } from 'react-native';

import { AppText, Icon } from '@/components/ui';
import { useData } from '@/data/DataProvider';
import { useOnline } from '@/hooks/useOnline';
import { colors, spacing } from '@/theme/tokens';

/** "21 October 2026 (3 h ago)": the retrieval date is always shown, not only a relative time. */
function retrieved(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'earlier';
  return `${formatLongDate(saLocalDate(d))} (${ago(iso)})`;
}

function ago(iso: string): string {
  const mins = Math.max(0, Math.round((Date.now() - Date.parse(iso)) / 60_000));
  if (mins < 2) return 'just now';
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
}

/** One line telling the user where the data on screen came from and how fresh it is. */
export function dataStatusText(
  origin: ReturnType<typeof useData>['origin'],
  retrievedAt: string | null,
  version: string,
): string {
  const versionDate = formatLongDate(version.slice(0, 10));
  switch (origin) {
    case 'live':
      return `Updated from the Toll-E server ${retrievedAt ? retrieved(retrievedAt) : ''}`.trim();
    case 'cached':
      return `Saved on this device · downloaded ${retrievedAt ? retrieved(retrievedAt) : 'earlier'}`;
    case 'bundled':
      return `Built into this app version · data of ${versionDate}`;
  }
}

export function DataStatus({ compact }: { compact?: boolean }) {
  const { origin, retrievedAt, dataset, refreshing, lastError, remoteConfigured } = useData();
  const online = useOnline();
  const offline = online === false;
  return (
    <View style={styles.row} accessible accessibilityRole="text">
      <Icon
        name={offline ? 'cloud-off-outline' : origin === 'live' ? 'cloud-check-outline' : 'database-outline'}
        size={16}
        color={colors.ink500}
      />
      <AppText variant="small" color={colors.ink500} style={styles.text} numberOfLines={compact ? 1 : 3}>
        {offline ? 'Offline · ' : ''}
        {dataStatusText(origin, retrievedAt, dataset.datasetVersion)}
        {refreshing ? ' · checking for updates…' : ''}
        {!compact && lastError && remoteConfigured ? ` · last update failed (${lastError})` : ''}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  text: { flex: 1 },
});
