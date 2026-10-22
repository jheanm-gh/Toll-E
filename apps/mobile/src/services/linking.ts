import * as Linking from 'expo-linking';

/**
 * Open a URL outside the app. Every navigation link Toll-E builds is a universal https URL,
 * so if the target app is not installed the system opens the browser instead.
 * Returns false when nothing could open it (the caller then shows the URL).
 */
export async function openExternal(url: string): Promise<boolean> {
  try {
    await Linking.openURL(url);
    return true;
  } catch {
    return false;
  }
}
