// Removes expo-location's background location services from the Android manifest.
// Toll-E reads the location once, in the foreground, when the user asks for nearby plazas
// (getCurrentPositionAsync), which needs neither service. Declaring them would add a
// foreground-service "location" type to the app for Google Play to review.
const { withAndroidManifest } = require('expo/config-plugins');

const SERVICES = [
  'expo.modules.location.services.LocationTaskService',
  'expo.modules.location.next.locationForegroundService.LocationForegroundService',
];

module.exports = function withoutLocationServices(config) {
  return withAndroidManifest(config, (cfg) => {
    const manifest = cfg.modResults.manifest;
    manifest.$['xmlns:tools'] = manifest.$['xmlns:tools'] ?? 'http://schemas.android.com/tools';
    const app = manifest.application?.[0];
    if (!app) return cfg;
    app.service = (app.service ?? []).filter((s) => !SERVICES.includes(s.$['android:name']));
    for (const name of SERVICES) app.service.push({ $: { 'android:name': name, 'tools:node': 'remove' } });
    return cfg;
  });
};
