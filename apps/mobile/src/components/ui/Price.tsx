import { formatZAR, spokenZAR } from '@toll-e/core';

import { colors, type TypographyVariant } from '@/theme/tokens';

import { AppText } from './AppText';

/** A rand amount with a screen-reader friendly label. */
export function Price({
  cents,
  variant = 'priceSmall',
  color = colors.ink900,
  muted,
}: {
  cents: number;
  variant?: Extract<TypographyVariant, 'price' | 'priceMedium' | 'priceSmall' | 'bodyStrong'>;
  color?: string;
  muted?: boolean;
}) {
  return (
    <AppText variant={variant} color={muted ? colors.ink500 : color} accessibilityLabel={spokenZAR(cents)}>
      {formatZAR(cents)}
    </AppText>
  );
}
