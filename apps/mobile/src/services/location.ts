import * as Location from 'expo-location';

import type { LatLng } from '@toll-e/core';

export type LocationResult =
  { status: 'ok'; coords: LatLng } | { status: 'denied' } | { status: 'unavailable'; message: string };

/**
 * Ask for the device position once, only when the user taps "Near me".
 * No background tracking and nothing is stored or sent anywhere.
 */
export async function getLocationOnce(): Promise<LocationResult> {
  try {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (permission.status !== 'granted') return { status: 'denied' };
    const position = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 12_000)),
    ]);
    const fix = position ?? (await Location.getLastKnownPositionAsync());
    if (!fix)
      return { status: 'unavailable', message: 'Your location could not be found. Try again outdoors or pick a town.' };
    return { status: 'ok', coords: { lat: fix.coords.latitude, lng: fix.coords.longitude } };
  } catch {
    return { status: 'unavailable', message: 'Location services are turned off or unavailable on this device.' };
  }
}

/**
 * Towns users can pick instead of sharing their location. City-centre positions, used only to
 * sort plazas by rough distance.
 */
export const REFERENCE_TOWNS: { name: string; coords: LatLng }[] = [
  { name: 'Johannesburg', coords: { lat: -26.2041, lng: 28.0473 } },
  { name: 'Pretoria', coords: { lat: -25.7479, lng: 28.2293 } },
  { name: 'Cape Town', coords: { lat: -33.9249, lng: 18.4241 } },
  { name: 'Durban', coords: { lat: -29.8587, lng: 31.0218 } },
  { name: 'Gqeberha', coords: { lat: -33.9608, lng: 25.6022 } },
  { name: 'Bloemfontein', coords: { lat: -29.0852, lng: 26.1596 } },
  { name: 'Polokwane', coords: { lat: -23.9045, lng: 29.4689 } },
  { name: 'Mbombela', coords: { lat: -25.4753, lng: 30.9694 } },
  { name: 'Pietermaritzburg', coords: { lat: -29.6006, lng: 30.3794 } },
  { name: 'Rustenburg', coords: { lat: -25.6676, lng: 27.2421 } },
  { name: 'George', coords: { lat: -33.963, lng: 22.4617 } },
  { name: 'Kimberley', coords: { lat: -28.7282, lng: 24.7499 } },
];
