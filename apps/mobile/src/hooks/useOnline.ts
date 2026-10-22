import { useNetworkState } from 'expo-network';

/**
 * Connectivity, as best the device can tell. `null` while unknown.
 * isInternetReachable can be undefined on some platforms; fall back to isConnected.
 */
export function useOnline(): boolean | null {
  const state = useNetworkState();
  if (state.isInternetReachable === false) return false;
  if (state.isInternetReachable === true) return true;
  if (state.isConnected === false) return false;
  if (state.isConnected === true) return true;
  return null;
}
