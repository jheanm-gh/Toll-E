import { Platform, Share } from 'react-native';

export type ShareOutcome = 'shared' | 'copied' | 'dismissed' | 'unavailable';

/** Share text with the system sheet; on browsers without it, copy to the clipboard. */
export async function shareText(message: string, title?: string): Promise<ShareOutcome> {
  try {
    const r = await Share.share(Platform.OS === 'ios' ? { message, title } : { message, title });
    return r.action === Share.dismissedAction ? 'dismissed' : 'shared';
  } catch {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(message);
        return 'copied';
      } catch {
        return 'unavailable';
      }
    }
    return 'unavailable';
  }
}
