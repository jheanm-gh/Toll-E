import { STANDARD_CLASS_LABEL } from '@toll-e/core';
import { router } from 'expo-router';
import { Alert, StyleSheet, Switch, View } from 'react-native';

import { ClassPicker } from '@/components/calculator/ClassPicker';
import { DataStatus } from '@/components/plaza/DataStatus';
import { AppText, Badge, Button, Card, Divider, ListRow, Screen, SectionHeader, useToast } from '@/components/ui';
import { appVersion, buildProfile, env, isDevelopment } from '@/config/env';
import { useData } from '@/data/DataProvider';
import { useAds } from '@/monetisation/ads/AdsProvider';
import { useEntitlement } from '@/monetisation/purchases/EntitlementProvider';
import { correctionChannel } from '@/services/corrections';
import { openExternal } from '@/services/linking';
import { usePreferences } from '@/state/preferences';
import { colors, spacing } from '@/theme/tokens';

export default function MoreScreen() {
  const prefs = usePreferences();
  const entitlement = useEntitlement();
  const ads = useAds();
  const data = useData();
  const toast = useToast();

  const open = async (url: string | null, label: string) => {
    if (!url) return;
    if (!(await openExternal(url))) Alert.alert(`Could not open ${label}`, url);
  };

  return (
    <Screen title="More" subtitle="Settings, privacy and information.">
      <SectionHeader
        title="Default vehicle"
        caption="Used for prices across the app. You can change it per calculation."
      />
      <ClassPicker
        value={prefs.defaultClass}
        onChange={(c) => {
          prefs.update({ defaultClass: c });
          toast(`Default set to ${STANDARD_CLASS_LABEL[c].label}`);
        }}
      />

      {entitlement.adFree || entitlement.purchasesOffered ? (
        <>
          <SectionHeader title="Ads" />
          <Card padded={false}>
            {entitlement.adFree ? (
              <ListRow
                icon="check-decagram"
                title="Ads removed"
                subtitle={
                  entitlement.serviceKind === 'simulated'
                    ? 'Simulated purchase (development build)'
                    : entitlement.confirmedThisSession
                      ? 'Thank you for supporting Toll-E.'
                      : 'Thank you. Confirmed with the store when you are online.'
                }
              />
            ) : (
              <ListRow
                icon="block-helper"
                title="Remove ads"
                subtitle="A once-off purchase. Toll information stays free either way."
                onPress={() => router.push('/remove-ads')}
              />
            )}
            {entitlement.purchasesOffered ? <Divider inset={spacing.lg} /> : null}
            {entitlement.purchasesOffered ? (
              <ListRow
                icon="restore"
                title="Restore purchase"
                subtitle="Already removed ads on another device or after reinstalling?"
                onPress={() => router.push({ pathname: '/remove-ads', params: { restore: '1' } })}
              />
            ) : null}
          </Card>
        </>
      ) : null}

      <SectionHeader title="Privacy" />
      <Card padded={false}>
        <View style={styles.switchRow}>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="bodyStrong">Personalised ads</AppText>
            <AppText variant="small" color={colors.ink500}>
              Off by default. When off, ads are not based on your activity in other apps.
            </AppText>
          </View>
          <Switch
            accessibilityLabel="Personalised ads"
            value={prefs.personalisedAds}
            onValueChange={(v) => prefs.update({ personalisedAds: v })}
            trackColor={{ true: colors.teal600, false: colors.borderStrong }}
            thumbColor={colors.white}
            disabled={entitlement.adFree}
          />
        </View>
        {ads.privacyOptionsRequired ? (
          <>
            <Divider inset={spacing.lg} />
            <ListRow
              icon="shield-account-outline"
              title="Ad privacy choices"
              subtitle="Review the consent choices required in your region."
              onPress={() => void ads.openPrivacyOptions()}
            />
          </>
        ) : null}
        <Divider inset={spacing.lg} />
        <ListRow
          icon="bullhorn-outline"
          title="About advertising in Toll-E"
          onPress={() => router.push('/advertising')}
        />
        <Divider inset={spacing.lg} />
        <ListRow icon="lock-outline" title="Privacy policy" onPress={() => router.push('/privacy')} />
      </Card>

      <SectionHeader title="Toll data" />
      <Card padded={false}>
        <ListRow
          icon="file-certificate-outline"
          title="Data sources & methods"
          subtitle="Where prices come from and how they are checked"
          onPress={() => router.push('/sources')}
        />
        {correctionChannel !== 'none' ? (
          <>
            <Divider inset={spacing.lg} />
            <ListRow icon="flag-outline" title="Report incorrect information" onPress={() => router.push('/report')} />
          </>
        ) : null}
        <Divider inset={spacing.lg} />
        <View style={styles.dataStatus}>
          <DataStatus />
          {data.remoteConfigured ? (
            <Button
              label={data.refreshing ? 'Checking…' : 'Check for updates'}
              size="sm"
              variant="secondary"
              loading={data.refreshing}
              onPress={() => void data.refresh()}
            />
          ) : (
            <AppText variant="small" color={colors.ink500}>
              Online updates are not configured in this build; the built-in data is used.
            </AppText>
          )}
        </View>
      </Card>

      <SectionHeader title="About" />
      <Card padded={false}>
        <ListRow icon="file-document-outline" title="Terms of use" onPress={() => router.push('/terms')} />
        {env.supportEmail ? (
          <>
            <Divider inset={spacing.lg} />
            <ListRow
              icon="email-outline"
              title="Contact support"
              subtitle={env.supportEmail}
              external
              onPress={() => open(`mailto:${env.supportEmail}`, 'email')}
            />
          </>
        ) : null}
        <Divider inset={spacing.lg} />
        <ListRow
          icon="information-outline"
          title={`Toll-E ${appVersion}`}
          subtitle={`Data ${data.dataset.datasetVersion} · ${buildProfile} build`}
        />
      </Card>

      {isDevelopment ? (
        <>
          <SectionHeader title="Developer" caption="Shown only in development and preview builds." />
          <Card style={{ gap: spacing.md }}>
            <Badge label="Development build" tone="warning" icon="wrench-outline" />
            <View style={styles.switchRow}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText variant="bodyStrong">Simulated store</AppText>
                <AppText variant="small" color={colors.ink500}>
                  Test purchase, cancel, pending and failure flows without store accounts.
                </AppText>
              </View>
              <Switch
                accessibilityLabel="Simulated store"
                value={prefs.simulatedStore}
                onValueChange={(v) => prefs.update({ simulatedStore: v })}
                trackColor={{ true: colors.amber500, false: colors.borderStrong }}
                thumbColor={colors.white}
              />
            </View>
            {entitlement.serviceKind === 'simulated' && entitlement.adFree ? (
              <Button
                label="Reset simulated purchase"
                variant="outline"
                size="sm"
                onPress={entitlement.resetSimulatedPurchase}
              />
            ) : null}
            <AppText variant="small" color={colors.ink500}>
              Purchases: {entitlement.serviceKind}
              {entitlement.unavailableReason ? ` — ${entitlement.unavailableReason}` : ''}
              {'\n'}Ads: {ads.status}
              {ads.unitId ? ' (Google test ads)' : ''}
              {'\n'}Backend: {data.remoteConfigured ? 'configured' : 'not configured'}
            </AppText>
          </Card>
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  dataStatus: { padding: spacing.lg, gap: spacing.md },
});
