import { Alert } from 'react-native';

import { ContentSections } from '@/components/ContentSection';
import { AppText, Button, Screen } from '@/components/ui';
import { env } from '@/config/env';
import { useEntitlement } from '@/monetisation/purchases/EntitlementProvider';
import { openExternal } from '@/services/linking';
import { colors } from '@/theme/tokens';

/**
 * Plain-language privacy summary. Must stay consistent with site/privacy.html and
 * with the SDKs actually enabled in the build.
 */
export default function PrivacyScreen() {
  const { purchasesOffered } = useEntitlement();
  return (
    <Screen edges={['bottom']}>
      <AppText variant="body" color={colors.ink700}>
        Toll-E is built to need as little information about you as possible. You do not need an account.
      </AppText>
      <ContentSections
        sections={[
          {
            heading: 'Stored only on your device',
            bullets: [
              'Your default vehicle class and settings',
              'Favourite plazas, saved and recent calculations, and recently viewed plazas (clear them in More → Privacy)',
              'A copy of the toll data, so the app works offline',
              'Whether you have removed ads',
              'A random code used only to limit spam in correction reports',
            ],
          },
          {
            heading: 'Your location',
            paragraphs: [
              'Toll-E asks for your location only when you tap “Near me” or “Use my location”. It is used once, on your device, to sort plazas by distance. It is not stored or sent to Toll-E. There is no background location tracking.',
            ],
          },
          {
            heading: 'What leaves your device',
            bullets: [
              'Toll data requests to the Toll-E server. Like any internet request, these reveal your IP address.',
              'Map images from the map tile provider (OpenFreeMap), which sees your IP address and the area you view.',
              'Reports you choose to send: your message, optional email, the random device code and app version. Reports and emails are deleted within 12 months of being resolved.',
              'When you open directions, the destination is passed to the navigation app you choose. Its own privacy policy applies.',
            ],
          },
          {
            heading: 'Advertising (free version)',
            paragraphs: [
              'Ads are provided by Google AdMob. To show and measure ads, Google receives information such as your IP address, device and app details, ad interactions and, on Android, the device advertising ID. Toll-E asks for non-personalised ads unless you switch on personalised ads in More → Privacy. Toll-E does not ask iOS for permission to track you. Where the law requires consent (for example in the EU or UK), Google’s consent message is shown.',
              ...(purchasesOffered ? ['If you buy ad removal, the ads SDK is not started at all.'] : []),
            ],
          },
          ...(purchasesOffered
            ? [
                {
                  heading: 'Purchases',
                  paragraphs: [
                    'Ad removal is paid through the App Store or Google Play; Toll-E never sees your card details. RevenueCat, our purchase service, receives an anonymous app user ID and the store receipt to confirm the purchase and allow restores.',
                  ],
                },
              ]
            : []),
          {
            heading: 'What Toll-E does not do',
            bullets: [
              'No accounts, no analytics SDK and no sale of personal information',
              'No collection of contacts, photos or precise location history',
            ],
          },
          {
            heading: 'Your rights',
            paragraphs: [
              'Under the Protection of Personal Information Act (POPIA) you may ask what personal information we hold about you, ask us to correct or delete it, and object to its use. You may also complain to the Information Regulator of South Africa.',
            ],
          },
        ]}
      />
      {env.privacyPolicyUrl ? (
        <Button
          label="Read the full privacy policy"
          variant="outline"
          icon="open-in-new"
          onPress={async () => {
            if (!(await openExternal(env.privacyPolicyUrl!)))
              Alert.alert('Could not open the link', env.privacyPolicyUrl!);
          }}
        />
      ) : (
        <AppText variant="small" color={colors.ink500}>
          The full privacy policy, including the responsible party’s contact details, will be published before release.
        </AppText>
      )}
    </Screen>
  );
}
