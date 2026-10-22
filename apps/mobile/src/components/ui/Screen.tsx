import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, type ScrollViewProps } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { colors, layout, spacing } from '@/theme/tokens';

import { AppText } from './AppText';

export interface ScreenProps extends Omit<ScrollViewProps, 'children'> {
  children: ReactNode;
  /** Large title rendered at the top of the scroll content. */
  title?: string;
  subtitle?: string;
  headerRight?: ReactNode;
  scroll?: boolean;
  edges?: Edge[];
  refreshing?: boolean;
  onRefresh?: () => void;
  footer?: ReactNode;
}

/** Standard screen container: safe area, background, padding and an optional large title. */
export function Screen({
  children,
  title,
  subtitle,
  headerRight,
  scroll = true,
  edges = ['top'],
  refreshing,
  onRefresh,
  footer,
  contentContainerStyle,
  ...rest
}: ScreenProps) {
  const header = title ? (
    <View style={styles.header}>
      <View style={styles.headerText}>
        <AppText variant="display" accessibilityRole="header">
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="body" color={colors.ink500}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {headerRight}
    </View>
  ) : null;

  return (
    <SafeAreaView edges={edges} style={styles.safe}>
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, contentContainerStyle]}
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} tintColor={colors.teal600} />
            ) : undefined
          }
          {...rest}>
          <View style={styles.inner}>
            {header}
            {children}
          </View>
        </ScrollView>
      ) : (
        <View style={[styles.flex, contentContainerStyle]}>
          {header ? <View style={styles.staticHeader}>{header}</View> : null}
          {children}
        </View>
      )}
      {footer}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.background },
  flex: { flex: 1 },
  content: { paddingHorizontal: layout.screenPadding, paddingBottom: spacing.huge, paddingTop: spacing.sm },
  inner: { width: '100%', maxWidth: layout.maxContentWidth, alignSelf: 'center', gap: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingTop: spacing.sm },
  headerText: { flex: 1, gap: spacing.xs },
  staticHeader: { paddingHorizontal: layout.screenPadding, paddingTop: spacing.sm },
});
