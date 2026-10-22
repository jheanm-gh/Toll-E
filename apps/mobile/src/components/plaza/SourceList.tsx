import { formatLongDate, type Source } from '@toll-e/core';
import { Alert, StyleSheet, View } from 'react-native';

import { AppText, Badge, Divider, ListRow } from '@/components/ui';
import { openExternal } from '@/services/linking';
import { colors, spacing } from '@/theme/tokens';

const KIND_LABEL: Record<Source['kind'], string> = {
  government_gazette: 'Government Gazette',
  agency_publication: 'Road agency publication',
  operator_publication: 'Operator publication',
  operator_website: 'Operator website',
  news: 'News report',
  secondary_compilation: 'Third-party compilation',
  map_data: 'Map data',
};

export function SourceList({ sources, showNotes }: { sources: Source[]; showNotes?: boolean }) {
  if (sources.length === 0) {
    return (
      <AppText variant="small" color={colors.ink500}>
        No source recorded.
      </AppText>
    );
  }
  return (
    <View>
      {sources.map((s, i) => (
        <View key={s.id}>
          {i > 0 ? <Divider inset={spacing.lg} /> : null}
          <ListRow
            title={s.title}
            subtitle={`${s.publisher} · ${KIND_LABEL[s.kind]} · checked ${formatLongDate(s.retrievedOn)}`}
            icon={s.official ? 'file-certificate-outline' : 'file-document-outline'}
            external
            accessibilityLabel={`${s.title}, ${s.official ? 'official source' : 'secondary source'}, ${s.publisher}`}
            onPress={async () => {
              const ok = await openExternal(s.url);
              if (!ok) Alert.alert('Could not open the link', s.url);
            }}
            right={<Badge label={s.official ? 'Official' : 'Secondary'} tone={s.official ? 'brand' : 'neutral'} />}
          />
          {showNotes && (s.reference || s.notes) ? (
            <View style={styles.notes}>
              {s.reference ? (
                <AppText variant="small" color={colors.ink700}>
                  {s.reference}
                </AppText>
              ) : null}
              {s.notes ? (
                <AppText variant="small" color={colors.ink500}>
                  {s.notes}
                </AppText>
              ) : null}
            </View>
          ) : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  notes: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, paddingLeft: spacing.lg + 48, gap: 2 },
});
