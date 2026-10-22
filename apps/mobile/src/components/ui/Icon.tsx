import { MaterialCommunityIcons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import type { ColorValue } from 'react-native';

import { colors } from '@/theme/tokens';

export type IconName = ComponentProps<typeof MaterialCommunityIcons>['name'];

export function Icon({
  name,
  size = 20,
  color = colors.ink700,
  accessibilityLabel,
}: {
  name: IconName;
  size?: number;
  color?: ColorValue;
  accessibilityLabel?: string;
}) {
  return (
    <MaterialCommunityIcons
      name={name}
      size={size}
      color={typeof color === 'number' || color == null ? undefined : color}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? 'yes' : 'no-hide-descendants'}
    />
  );
}
