import { render } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ToastProvider } from '@/components/ui';
import { DataProvider } from '@/data/DataProvider';
import { AdsProvider } from '@/monetisation/ads/AdsProvider';
import { EntitlementProvider } from '@/monetisation/purchases/EntitlementProvider';
import { PreferencesProvider } from '@/state/preferences';
import { SavedProvider } from '@/state/saved';

const metrics = { frame: { x: 0, y: 0, width: 390, height: 844 }, insets: { top: 0, left: 0, right: 0, bottom: 0 } };

/** Renders with the same provider stack as app/_layout.tsx. */
export function renderApp(ui: ReactElement) {
  return render(
    <SafeAreaProvider initialMetrics={metrics}>
      <PreferencesProvider>
        <EntitlementProvider>
          <AdsProvider>
            <DataProvider>
              <SavedProvider>
                <ToastProvider>{ui}</ToastProvider>
              </SavedProvider>
            </DataProvider>
          </AdsProvider>
        </EntitlementProvider>
      </PreferencesProvider>
    </SafeAreaProvider>,
  );
}
