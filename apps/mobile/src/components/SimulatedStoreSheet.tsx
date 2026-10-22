import { Modal, StyleSheet, View } from 'react-native';

import { AppText, Badge, Button } from '@/components/ui';
import { useEntitlement } from '@/monetisation/purchases/EntitlementProvider';
import { colors, radii, spacing } from '@/theme/tokens';

/**
 * DEVELOPMENT ONLY: stands in for the App Store / Google Play purchase sheet when the
 * simulated store is switched on, so every purchase outcome can be exercised.
 */
export function SimulatedStoreSheet() {
  const { simulatedPrompt, answerSimulatedPrompt } = useEntitlement();
  return (
    <Modal
      visible={simulatedPrompt}
      transparent
      animationType="fade"
      onRequestClose={() => answerSimulatedPrompt('cancel')}>
      <View style={styles.backdrop}>
        <View style={styles.sheet} accessibilityViewIsModal>
          <Badge label="Simulated store — development only" tone="warning" icon="flask-outline" />
          <AppText variant="heading">Simulate a purchase result</AppText>
          <AppText variant="small" color={colors.ink500}>
            No money is involved. Choose what the store should report back to Toll-E.
          </AppText>
          <Button label="Approve purchase" onPress={() => answerSimulatedPrompt('approve')} />
          <Button label="Payment pending" variant="outline" onPress={() => answerSimulatedPrompt('pending')} />
          <Button label="Store error" variant="outline" onPress={() => answerSimulatedPrompt('fail')} />
          <Button label="Cancel" variant="ghost" onPress={() => answerSimulatedPrompt('cancel')} />
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay, justifyContent: 'center', padding: spacing.xl },
  sheet: {
    backgroundColor: colors.surface,
    borderRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
    maxWidth: 420,
    width: '100%',
    alignSelf: 'center',
  },
});
