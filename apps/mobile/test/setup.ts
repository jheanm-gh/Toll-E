/* eslint-disable @typescript-eslint/no-require-imports */
// Native modules that have no JavaScript implementation in Jest are replaced with small fakes.
// Tests that need to control a fake import it and adjust it (see test/mocks.ts).

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('expo-network', () => ({
  useNetworkState: () => require('./mocks').network,
}));

jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'denied' })),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));

jest.mock('react-native-google-mobile-ads', () => require('./mocks').googleMobileAds);

jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: { configure: jest.fn(), getCustomerInfo: jest.fn(), addCustomerInfoUpdateListener: jest.fn() },
}));

jest.mock('@maplibre/maplibre-react-native', () => {
  const { View } = require('react-native');
  const Stub = (props: object) => require('react').createElement(View, props);
  return { Map: Stub, Camera: Stub, GeoJSONSource: Stub, Layer: Stub, MapView: Stub };
});

// The screens only use these parts of expo-router; navigation itself is not under test here.
jest.mock('expo-router', () => ({
  router: { push: jest.fn(), back: jest.fn(), setParams: jest.fn(), replace: jest.fn() },
  useLocalSearchParams: () => require('./mocks').routeParams,
  Stack: { Screen: () => null },
}));

// Icon fonts are not loaded in Jest; icons render as their accessible name.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  const React = require('react');
  const Icon = ({ name }: { name: string }) => React.createElement(Text, { testID: `icon-${name}` }, '');
  Icon.glyphMap = new Proxy({}, { get: () => 0, has: () => true });
  return { MaterialCommunityIcons: Icon };
});
