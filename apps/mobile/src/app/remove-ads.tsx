import { useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/brand/Logo';
import { AppText, Badge, Banner, Button, Card, EmptyState, Icon, Screen } from '@/components/ui';
import { useEntitlement } from '@/monetisation/purchases/EntitlementProvider';
import type { PurchaseOutcome, RestoreOutcome } from '@/monetisation/purchases/types';
import { colors, spacing } from '@/theme/tokens';

type Message = { tone: 'success' | 'info' | 'warning'; title: string; body: string } | null;

function purchaseMessage(o: PurchaseOutcome): Message {
  switch (o.kind) {
    case 'success':
      return {
        tone: 'success',
        title: 'Ads removed',
        body: 'Thank you for supporting Toll-E. Ads are gone on this device and will stay gone after restarts.',
      };
    case 'already_owned':
      return {
        tone: 'success',
        title: 'You already own ad removal',
        body: 'Your purchase has been restored on this device.',
      };
    case 'cancelled':
      return {
        tone: 'info',
        title: 'Purchase cancelled',
        body: 'No payment was taken. Ads remain on.',
      };
    case 'pending':
      return {
        tone: 'info',
        title: 'Payment pending',
        body: 'The store has not confirmed the payment yet. Ads will be removed automatically once it does.',
      };
    case 'error':
      return {
        tone: 'warning',
        title: o.offline ? 'You appear to be offline' : 'The purchase did not complete',
        body: o.offline ? 'Connect to the internet and try again. No payment was taken.' : o.message,
      };
  }
}

function restoreMessage(o: RestoreOutcome): Message {
  switch (o.kind) {
    case 'restored':
      return {
        tone: 'success',
        title: 'Purchase restored',
        body: 'Ads have been removed on this device.',
      };
    case 'nothing_to_restore':
      return {
        tone: 'info',
        title: 'Nothing to restore',
        body: 'No ad-removal purchase was found for the store account on this device.',
      };
    case 'error':
      return {
        tone: 'warning',
        title: o.offline ? 'You appear to be offline' : 'Restore did not complete',
        body: o.offline ? 'Connect to the internet and try again.' : o.message,
      };
  }
}

export default function RemoveAdsScreen() {
  const { restore: restoreParam } = useLocalSearchParams<{ restore?: string }>();
  const e = useEntitlement();
  const [busy, setBusy] = useState<'buy' | 'restore' | null>(null);
  const [message, setMessage] = useState<Message>(null);
  const unavailable = e.serviceKind === 'unavailable';
  const { reloadProduct } = e;

  useEffect(() => {
    void reloadProduct();
  }, [reloadProduct]);

  const buy = async () => {
    setBusy('buy');
    setMessage(null);
    setMessage(purchaseMessage(await e.purchase()));
    setBusy(null);
  };
  const restore = async () => {
    setBusy('restore');
    setMessage(null);
    setMessage(restoreMessage(await e.restore()));
    setBusy(null);
  };

  if (!e.purchasesOffered && !e.adFree) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState
          icon="block-helper"
          title="Not offered in this version"
          body="Removing ads is not offered in this version of Toll-E. Toll prices, the map and the calculator are free for everyone."
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <View style={styles.hero}>
        <LogoMark size={64} />
        <AppText variant="title" align="center">
          {e.adFree ? 'Toll-E is ad-free' : 'Remove ads, once'}
        </AppText>
        <AppText variant="body" color={colors.ink700} align="center">
          {e.adFree
            ? 'Thank you for supporting independent toll information.'
            : 'One payment removes advertising from Toll-E for good. Toll prices, the map and the calculator stay free for everyone — buying this unlocks nothing else.'}
        </AppText>
        {e.serviceKind === 'simulated' ? (
          <Badge label="Simulated store — development only" tone="warning" icon="flask-outline" />
        ) : null}
      </View>

      {message ? (
        <Banner tone={message.tone} title={message.title}>
          {message.body}
        </Banner>
      ) : null}

      {!e.adFree ? (
        <Card style={styles.card}>
          {[
            ['check', 'No banners on the home screen, plaza list or plaza pages'],
            ['check', 'A once-off purchase — not a subscription'],
            ['check', 'Restore it on a new phone with the same store account'],
          ].map(([icon, text]) => (
            <View key={text} style={styles.benefit}>
              <Icon name={icon as 'check'} size={20} color={colors.success} />
              <AppText variant="body" style={{ flex: 1 }}>
                {text}
              </AppText>
            </View>
          ))}

          {unavailable ? (
            <Banner tone="info" title="Not available here">
              {e.unavailableReason ?? 'Purchases are not available in this build.'}
            </Banner>
          ) : e.productStatus === 'loading' || e.productStatus === 'idle' ? (
            <View style={styles.loading}>
              <ActivityIndicator color={colors.teal600} />
              <AppText variant="small" color={colors.ink500}>
                Getting the price from the store…
              </AppText>
            </View>
          ) : e.productStatus === 'ready' && e.product ? (
            <Button
              label={`Remove ads · ${e.product.priceString}`}
              onPress={buy}
              loading={busy === 'buy'}
              disabled={!!busy}
              accessibilityHint="Opens the store's payment sheet"
            />
          ) : (
            <View style={{ gap: spacing.sm }}>
              <Banner
                tone="warning"
                title={
                  e.productStatus === 'error'
                    ? 'Could not reach the store'
                    : 'Ad removal is not available in your store yet'
                }>
                {e.productStatus === 'error' ? 'Check your connection and try again.' : 'Please try again later.'}
              </Banner>
              <Button label="Try again" variant="outline" onPress={() => void e.reloadProduct()} />
            </View>
          )}
          <AppText variant="small" color={colors.ink500}>
            The price is set by and charged through the App Store or Google Play, in your local currency. Refunds and
            restores follow the store’s rules.
          </AppText>
        </Card>
      ) : null}

      <Card style={styles.card}>
        <AppText variant="heading">{restoreParam === '1' ? 'Restore your purchase' : 'Already paid?'}</AppText>
        <AppText variant="small" color={colors.ink700}>
          If you removed ads before — on this or another device signed in to the same store account — restore it here.
        </AppText>
        <Button
          label="Restore purchase"
          variant={restoreParam === '1' ? 'primary' : 'outline'}
          icon="restore"
          onPress={restore}
          loading={busy === 'restore'}
          disabled={unavailable || !!busy}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.lg },
  card: { gap: spacing.md },
  benefit: { flexDirection: 'row', gap: spacing.sm, alignItems: 'center' },
  loading: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    justifyContent: 'center',
    minHeight: 48,
  },
});
