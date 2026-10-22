import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, ScrollView, View } from 'react-native';

import { AppText, Banner, Button, Card, Chip, Screen, TextField } from '@/components/ui';
import { useData, usePlaza } from '@/data/DataProvider';
import { useOnline } from '@/hooks/useOnline';
import { correctionChannel, correctionMailto, submitCorrection, type CorrectionCategory } from '@/services/corrections';
import { openExternal } from '@/services/linking';
import { colors, spacing } from '@/theme/tokens';

const CATEGORIES: { value: CorrectionCategory; label: string }[] = [
  { value: 'tariff', label: 'Wrong price' },
  { value: 'location', label: 'Wrong location' },
  { value: 'plaza_details', label: 'Plaza details' },
  { value: 'payment', label: 'Payment methods' },
  { value: 'journey', label: 'Route / plaza list' },
  { value: 'other', label: 'Something else' },
];

export default function ReportScreen() {
  const { plazaId } = useLocalSearchParams<{ plazaId?: string }>();
  const plaza = usePlaza(plazaId);
  const { dataset } = useData();
  const online = useOnline();
  const [category, setCategory] = useState<CorrectionCategory>('tariff');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'sending' | 'sent' | { error: string }>('idle');
  const trimmed = message.trim();
  const tooShort = trimmed.length < 10;
  const emailInvalid = email.trim() !== '' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());

  const input = {
    category,
    message: trimmed,
    plazaId: plaza?.id,
    contactEmail: email.trim() || undefined,
    datasetVersion: dataset.datasetVersion,
  };

  const send = async () => {
    if (correctionChannel === 'email') {
      const url = correctionMailto(input);
      if (url && !(await openExternal(url))) Alert.alert('Could not open your email app');
      return;
    }
    setState('sending');
    const r = await submitCorrection(input);
    setState(r.ok ? 'sent' : { error: r.message });
  };

  if (state === 'sent') {
    return (
      <Screen edges={['bottom']}>
        <Banner tone="success" title="Thank you — report received">
          Toll-E checks every report against the official source before changing anything. Reports never change prices
          directly.
        </Banner>
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <AppText variant="body" color={colors.ink700}>
        Seen a price, location or detail that is wrong? Tell us what you saw and, if you can, where (a receipt, the
        plaza board or an official notice).
      </AppText>
      {plaza ? (
        <Card tone="muted">
          <AppText variant="small" color={colors.ink500}>
            About
          </AppText>
          <AppText variant="bodyStrong">
            {plaza.name} ({plaza.route})
          </AppText>
        </Card>
      ) : null}

      <View style={{ gap: spacing.sm }}>
        <AppText variant="smallStrong" color={colors.ink700}>
          What is wrong?
        </AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {CATEGORIES.map((c) => (
            <Chip key={c.value} label={c.label} selected={category === c.value} onPress={() => setCategory(c.value)} />
          ))}
        </ScrollView>
      </View>

      <TextField
        label="Details"
        multiline
        value={message}
        onChangeText={setMessage}
        maxLength={2000}
        placeholder="e.g. Class 1 at this plaza was R72.00 on 20 October, not R70.00"
        hint={`${trimmed.length}/2000 · at least 10 characters`}
      />
      <TextField
        label="Email (optional)"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        error={emailInvalid ? 'Enter a valid email address or leave this empty' : null}
        hint="Only if you would like a reply. Used for this report only and deleted within 12 months."
      />

      {typeof state === 'object' ? (
        <Banner tone="warning" title="Not sent">
          {state.error}
        </Banner>
      ) : null}
      {correctionChannel === 'none' ? (
        <Banner tone="info" title="Reporting is not set up in this build">
          You can still contact the operator directly — see the operator link on each plaza page.
        </Banner>
      ) : null}
      {correctionChannel === 'backend' && online === false ? (
        <Banner tone="offline" title="You are offline">
          Connect to the internet to send your report.
        </Banner>
      ) : null}

      <Button
        label={correctionChannel === 'email' ? 'Continue in your email app' : 'Send report'}
        icon="send-outline"
        onPress={send}
        loading={state === 'sending'}
        disabled={
          tooShort ||
          emailInvalid ||
          correctionChannel === 'none' ||
          (correctionChannel === 'backend' && online === false)
        }
      />
      <AppText variant="small" color={colors.ink500}>
        We store your report, an anonymous device code (to limit spam), the app and data version. No location or account
        details are collected.
      </AppText>
    </Screen>
  );
}
