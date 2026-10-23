import { router } from 'expo-router';

import { ContentSections } from '@/components/ContentSection';
import { Button, Screen } from '@/components/ui';
import { useEntitlement } from '@/monetisation/purchases/EntitlementProvider';
import { correctionChannel } from '@/services/corrections';

export default function AdvertisingScreen() {
  const { adFree, purchasesOffered } = useEntitlement();
  return (
    <Screen edges={['bottom']}>
      <ContentSections
        sections={[
          {
            heading: 'Why Toll-E has ads',
            paragraphs: [
              'Toll-E is free. Advertising pays for keeping toll data checked and up to date. Toll prices, the map and the calculator are free for everyone, with or without ads.',
            ],
          },
          {
            heading: 'Where ads appear',
            bullets: [
              'At most one banner on the home screen, one in the plaza list and one at the bottom of a plaza page.',
              'Every ad is labelled “Advertisement” and kept apart from toll information.',
              'Never on the map, in the calculator, on the purchase screen or next to directions.',
              'No pop-up, full-screen or video ads.',
            ],
          },
          {
            heading: 'Your choices',
            bullets: [
              'Ads are not personalised unless you switch on personalised ads in More → Privacy.',
              ...(purchasesOffered ? ['You can remove all ads with a once-off purchase.'] : []),
              ...(correctionChannel !== 'none'
                ? ['If an ad looks misleading or offensive, please report it via More → Report incorrect information.']
                : []),
            ],
          },
        ]}
      />
      {!adFree && purchasesOffered ? <Button label="Remove ads" onPress={() => router.push('/remove-ads')} /> : null}
    </Screen>
  );
}
