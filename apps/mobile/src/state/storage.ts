import AsyncStorage from '@react-native-async-storage/async-storage';
import type { z } from 'zod';

/**
 * Typed, validated local storage. Everything read back from the device is parsed with a
 * schema; corrupt or outdated values are discarded rather than crashing the app.
 */
export const KEYS = {
  preferences: 'tolle.preferences.v1',
  saved: 'tolle.saved.v1',
  datasetCache: 'tolle.dataset-cache.v1',
  entitlement: 'tolle.entitlement.v1',
  clientId: 'tolle.client-id.v1',
} as const;

export async function readJson<T>(key: string, schema: z.ZodType<T>): Promise<T | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (raw === null) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

export async function writeJson(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Storage full or unavailable: the app keeps working with in-memory state.
  }
}

export async function removeKey(key: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // ignore
  }
}

/** A random identifier for abuse limits on correction reports. Not linked to a person. */
export async function getClientId(): Promise<string> {
  const existing = await AsyncStorage.getItem(KEYS.clientId).catch(() => null);
  if (existing && /^[0-9a-f-]{36}$/.test(existing)) return existing;
  const bytes = Array.from({ length: 16 }, () => Math.floor(Math.random() * 256));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.map((b) => b.toString(16).padStart(2, '0')).join('');
  const id = `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  await AsyncStorage.setItem(KEYS.clientId, id).catch(() => undefined);
  return id;
}
