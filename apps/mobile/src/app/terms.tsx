import { Alert } from 'react-native';

import { ContentSections } from '@/components/ContentSection';
import { AppText, Button, Screen } from '@/components/ui';
import { env } from '@/config/env';
import { openExternal } from '@/services/linking';
import { colors } from '@/theme/tokens';

export default function TermsScreen() {
  return (
    <Screen edges={['bottom']}>
      <ContentSections
        sections={[
          {
            heading: 'Information, not advice',
            paragraphs: [
              'Toll-E gives information about South African toll plazas and toll costs, gathered from official and other published sources. Each price shows its source and whether it has been verified. Tariffs change, and Toll-E can be wrong or out of date.',
              'Always check the amount displayed at the plaza or with the operator. The amount charged at the plaza is what you pay.',
            ],
          },
          {
            heading: 'Estimates',
            paragraphs: [
              'Journey totals are estimates based on the plazas listed. Your actual route, vehicle classification, discounts or operator decisions may change what you pay. Partial totals are clearly marked.',
            ],
          },
          {
            heading: 'Not a navigation app',
            paragraphs: [
              'Toll-E does not provide turn-by-turn navigation. Directions open in a separate app, which is responsible for routing. Do not use Toll-E while driving.',
            ],
          },
          {
            heading: 'Ad removal',
            paragraphs: [
              'The optional once-off ad-removal purchase removes advertising from Toll-E. It does not unlock other content or guarantee that toll information is complete or correct. Payment, refunds and restores are handled by the App Store or Google Play under their terms.',
            ],
          },
          {
            heading: 'Liability',
            paragraphs: [
              'To the extent the law allows, Toll-E is not liable for loss arising from reliance on its toll information. Nothing in these terms limits rights you have under the Consumer Protection Act.',
            ],
          },
        ]}
      />
      {env.termsUrl ? (
        <Button
          label="Read the full terms"
          variant="outline"
          icon="open-in-new"
          onPress={async () => {
            if (!(await openExternal(env.termsUrl!))) Alert.alert('Could not open the link', env.termsUrl!);
          }}
        />
      ) : (
        <AppText variant="small" color={colors.ink500}>
          This is a summary. The full terms will be published before release.
        </AppText>
      )}
    </Screen>
  );
}
