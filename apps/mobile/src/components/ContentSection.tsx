import { StyleSheet, View } from 'react-native';

import { AppText, Card } from '@/components/ui';
import { colors, spacing } from '@/theme/tokens';

export interface Section {
  heading: string;
  paragraphs?: string[];
  bullets?: string[];
}

export function ContentSections({ sections }: { sections: Section[] }) {
  return (
    <>
      {sections.map((s) => (
        <Card key={s.heading} style={styles.card}>
          <AppText variant="heading" accessibilityRole="header">
            {s.heading}
          </AppText>
          {s.paragraphs?.map((p) => (
            <AppText key={p} variant="body" color={colors.ink700}>
              {p}
            </AppText>
          ))}
          {s.bullets?.map((b) => (
            <View key={b} style={styles.bullet}>
              <AppText variant="body" color={colors.teal700}>
                •
              </AppText>
              <AppText variant="body" color={colors.ink700} style={{ flex: 1 }}>
                {b}
              </AppText>
            </View>
          ))}
        </Card>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm },
  bullet: { flexDirection: 'row', gap: spacing.sm },
});
