import { Alert, Platform } from 'react-native';

/** Asks before a destructive action. `action` is the label of the confirming button, e.g. "Delete". */
export function confirmDestructive(
  { title, message, action }: { title: string; message?: string; action: string },
  onConfirm: () => void,
) {
  if (Platform.OS === 'web') {
    if (globalThis.confirm?.(message ? `${title}\n\n${message}` : title)) onConfirm();
    return;
  }
  Alert.alert(title, message, [
    { text: 'Cancel', style: 'cancel' },
    { text: action, style: 'destructive', onPress: onConfirm },
  ]);
}
