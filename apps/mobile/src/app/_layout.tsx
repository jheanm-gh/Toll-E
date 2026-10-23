import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/plus-jakarta-sans';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { DefaultTheme, Stack, ThemeProvider, type ErrorBoundaryProps } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SimulatedStoreSheet } from '@/components/SimulatedStoreSheet';
import { AppText, Button, EmptyState, ToastProvider } from '@/components/ui';
import { DataProvider } from '@/data/DataProvider';
import { AdsProvider } from '@/monetisation/ads/AdsProvider';
import { EntitlementProvider } from '@/monetisation/purchases/EntitlementProvider';
import { PreferencesProvider } from '@/state/preferences';
import { SavedProvider } from '@/state/saved';
import { colors, fonts } from '@/theme/tokens';

void SplashScreen.preventAutoHideAsync();

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: colors.teal600,
    background: colors.background,
    card: colors.surface,
    text: colors.ink900,
    border: colors.border,
  },
};

export default function RootLayout() {
  const [loaded, error] = useFonts({
    PlusJakartaSans_400Regular,
    PlusJakartaSans_500Medium,
    PlusJakartaSans_600SemiBold,
    PlusJakartaSans_700Bold,
    PlusJakartaSans_800ExtraBold,
    ...MaterialCommunityIcons.font,
  });

  useEffect(() => {
    if (loaded || error) void SplashScreen.hideAsync();
  }, [loaded, error]);
  // Never leave the user on the splash screen: hide it after a few seconds whatever happens.
  useEffect(() => {
    const t = setTimeout(() => void SplashScreen.hideAsync(), 6000);
    return () => clearTimeout(t);
  }, []);

  // If fonts fail we continue with system fonts rather than block the app.
  if (!loaded && !error) return null;

  return (
    <SafeAreaProvider>
      <ThemeProvider value={navTheme}>
        <PreferencesProvider>
          <EntitlementProvider>
            <AdsProvider>
              <DataProvider>
                <SavedProvider>
                  <ToastProvider>
                    <StatusBar style="dark" />
                    <Stack
                      screenOptions={{
                        headerTintColor: colors.navy900,
                        headerTitleStyle: { fontFamily: fonts.bold, fontSize: 17 },
                        headerBackButtonDisplayMode: 'minimal',
                        headerShadowVisible: false,
                        headerStyle: { backgroundColor: colors.background },
                        contentStyle: { backgroundColor: colors.background },
                      }}>
                      <Stack.Screen name="(tabs)" options={{ headerShown: false, title: 'Toll-E' }} />
                      <Stack.Screen name="plazas/index" options={{ title: 'Toll plazas' }} />
                      <Stack.Screen name="plazas/[id]" options={{ title: 'Toll plaza' }} />
                      <Stack.Screen name="sources" options={{ title: 'Data sources & methods' }} />
                      <Stack.Screen name="privacy" options={{ title: 'Privacy' }} />
                      <Stack.Screen name="terms" options={{ title: 'Terms of use' }} />
                      <Stack.Screen name="advertising" options={{ title: 'Advertising' }} />
                      <Stack.Screen name="remove-ads" options={{ title: 'Remove ads', presentation: 'modal' }} />
                      <Stack.Screen
                        name="report"
                        options={{ title: 'Report incorrect information', presentation: 'modal' }}
                      />
                    </Stack>
                    <SimulatedStoreSheet />
                  </ToastProvider>
                </SavedProvider>
              </DataProvider>
            </AdsProvider>
          </EntitlementProvider>
        </PreferencesProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

/** Shown if a screen throws. Toll-E never shows a blank screen on an error. */
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View style={styles.error}>
      <EmptyState
        icon="alert-circle-outline"
        title="Something went wrong"
        body="This screen could not be shown. Your saved items are safe."
        action={<Button label="Try again" onPress={retry} />}
      />
      {__DEV__ ? (
        <AppText variant="small" color={colors.ink500} align="center">
          {error.message}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  error: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: colors.background },
});
