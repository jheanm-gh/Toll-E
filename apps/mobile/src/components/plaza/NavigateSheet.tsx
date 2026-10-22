import { NAVIGATION_APPS, type NavigationApp } from '@toll-e/core';
import { Alert, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText, Button, Icon, type IconName } from '@/components/ui';
import { openExternal } from '@/services/linking';
import { colors, radii, spacing, touchTarget } from '@/theme/tokens';

const ICONS: Record<NavigationApp, IconName> = {
  google_maps: 'google-maps',
  waze: 'waze',
  apple_maps: 'apple',
};

/**
 * Hand over to a navigation app. Toll-E passes only the destination (and origin for journeys);
 * no toll information is transferred.
 */
export function NavigateSheet({
  visible,
  onClose,
  title,
  note,
  urlFor,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  note?: string;
  urlFor: (app: NavigationApp) => string;
}) {
  const insets = useSafeAreaInsets();
  const platform = Platform.OS === 'ios' ? 'ios' : Platform.OS === 'android' ? 'android' : 'web';
  const apps = NAVIGATION_APPS.filter((a) => a.platforms.includes(platform));
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={styles.handle} />
        <AppText variant="heading">{title}</AppText>
        <AppText variant="small" color={colors.ink500}>
          {note ??
            'Opens your navigation app. If it is not installed, the link opens in your browser. Toll prices are not sent to the app.'}
        </AppText>
        <View style={styles.list}>
          {apps.map((a) => (
            <Pressable
              key={a.id}
              accessibilityRole="link"
              accessibilityLabel={`Open in ${a.label}`}
              onPress={async () => {
                const url = urlFor(a.id);
                const ok = await openExternal(url);
                if (!ok) Alert.alert(`Could not open ${a.label}`, url);
                onClose();
              }}
              style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.surfaceMuted }]}>
              <Icon name={ICONS[a.id]} size={22} color={colors.navy900} />
              <AppText variant="bodyStrong" style={{ flex: 1 }}>
                {a.label}
              </AppText>
              <Icon name="open-in-new" size={18} color={colors.ink400} />
            </Pressable>
          ))}
        </View>
        <Button label="Cancel" variant="outline" onPress={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radii.xl,
    borderTopRightRadius: radii.xl,
    padding: spacing.xl,
    gap: spacing.md,
  },
  handle: { alignSelf: 'center', width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong },
  list: { borderWidth: 1, borderColor: colors.border, borderRadius: radii.md, overflow: 'hidden' },
  option: {
    minHeight: touchTarget + 4,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
});
