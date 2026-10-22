import { Platform, type TextStyle, type ViewStyle } from 'react-native';

/**
 * Toll-E design tokens. Light theme only: a dark theme will be added only when every screen,
 * map style and ad placement can support it properly.
 *
 * Contrast: text colours are checked against `surface` and `background` for WCAG AA
 * (ink700 ≈ 10:1, ink500 ≈ 5.9:1, teal700 ≈ 5.6:1, navy900 ≈ 16:1).
 */
export const colors = {
  // brand
  navy900: '#0B1F3A',
  navy800: '#12294A',
  navy700: '#1B3A63',
  navy100: '#E6ECF4',
  teal700: '#0A6E70',
  teal600: '#0E8A8C',
  teal500: '#16A3A5',
  teal100: '#D3EFEF',
  teal50: '#EAF7F7',
  amber600: '#C77A0C',
  amber500: '#F2A93B',
  amber100: '#FDEBCB',
  amber50: '#FFF7EA',

  // neutrals
  background: '#F6F4EF',
  surface: '#FFFFFF',
  surfaceMuted: '#F1EFE9',
  ink900: '#0F172A',
  ink700: '#334155',
  ink500: '#5B6475',
  ink400: '#8A93A3',
  border: '#E3E1DA',
  borderStrong: '#C9C6BC',

  // semantic
  success: '#12704C',
  successBg: '#E5F4EC',
  warning: '#8A5300',
  warningBg: '#FFF3DB',
  review: '#A8430A',
  reviewBg: '#FDEDE3',
  danger: '#B42318',
  dangerBg: '#FDECEA',
  info: '#1D4E89',
  infoBg: '#E8F0FB',

  white: '#FFFFFF',
  overlay: 'rgba(11, 31, 58, 0.45)',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radii = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

/** Minimum touch target (Apple HIG 44pt / Material 48dp). */
export const touchTarget = 48;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  extrabold: 'PlusJakartaSans_800ExtraBold',
} as const;

const tabular: TextStyle = { fontVariant: ['tabular-nums'] };

export const typography = {
  display: { fontFamily: fonts.extrabold, fontSize: 30, lineHeight: 36, letterSpacing: -0.6 },
  title: { fontFamily: fonts.bold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.bold, fontSize: 17, lineHeight: 24, letterSpacing: -0.1 },
  subheading: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  body: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fonts.semibold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fonts.medium, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fonts.bold, fontSize: 13, lineHeight: 18 },
  label: { fontFamily: fonts.bold, fontSize: 11.5, lineHeight: 16, letterSpacing: 0.7, textTransform: 'uppercase' },
  price: { fontFamily: fonts.extrabold, fontSize: 34, lineHeight: 40, letterSpacing: -0.8, ...tabular },
  priceMedium: { fontFamily: fonts.extrabold, fontSize: 22, lineHeight: 28, letterSpacing: -0.3, ...tabular },
  priceSmall: { fontFamily: fonts.bold, fontSize: 16, lineHeight: 22, ...tabular },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;

export const elevation: Record<'card' | 'raised', ViewStyle> = {
  card: Platform.select<ViewStyle>({
    ios: { shadowColor: colors.navy900, shadowOpacity: 0.06, shadowRadius: 10, shadowOffset: { width: 0, height: 3 } },
    android: { elevation: 1 },
    default: { boxShadow: '0 2px 10px rgba(11, 31, 58, 0.06)' } as ViewStyle,
  }),
  raised: Platform.select<ViewStyle>({
    ios: { shadowColor: colors.navy900, shadowOpacity: 0.16, shadowRadius: 18, shadowOffset: { width: 0, height: 8 } },
    android: { elevation: 6 },
    default: { boxShadow: '0 8px 24px rgba(11, 31, 58, 0.16)' } as ViewStyle,
  }),
};

export const layout = {
  screenPadding: spacing.lg,
  maxContentWidth: 640,
} as const;
