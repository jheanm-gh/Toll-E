import { Stack, router } from 'expo-router';

import { Button, EmptyState, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <Screen>
      <Stack.Screen options={{ title: 'Not found' }} />
      <EmptyState
        icon="map-marker-question-outline"
        title="This page does not exist"
        body="The link may be out of date."
        action={<Button label="Go to Toll-E home" onPress={() => router.replace('/')} />}
      />
    </Screen>
  );
}
