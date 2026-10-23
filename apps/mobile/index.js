// App entry. Installs a last-resort error handler before anything else loads, so an error while
// the app starts shows a message (with the details a developer needs) instead of the app closing
// silently. Then starts Expo Router.
import { Alert } from 'react-native';

const previousHandler = global.ErrorUtils?.getGlobalHandler?.();
global.ErrorUtils?.setGlobalHandler?.((error, isFatal) => {
  if (isFatal) {
    const stack = String(error?.stack ?? '')
      .split('\n')
      .slice(0, 8)
      .join('\n');
    Alert.alert(
      'Toll-E could not start',
      `${error?.name ?? 'Error'}: ${error?.message ?? String(error)}\n\n${stack}\n\nPlease send a screenshot of this message.`,
    );
    return;
  }
  previousHandler?.(error, isFatal);
});

// Loaded after the handler is installed (an import would be hoisted above it).
require('expo-router/entry');
