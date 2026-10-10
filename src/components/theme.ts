import { Platform, type ViewStyle } from 'react-native';

export const colors = {
  navy: '#0B2545',
  navy2: '#13315C',
  brand: '#1B4B8F',

  red: '#D32F2F',
  redDark: '#9A1B1B',
  redBg: '#FDECEC',
  amber: '#B45309',
  amberBg: '#FFF4E5',
  blue: '#1565C0',
  blueBg: '#EAF2FC',
  green: '#1E7B45',
  greenBg: '#E7F5EC',
  purple: '#6B3FA0',
  purpleBg: '#F1EAFA',
  orange: '#D9480F',
  orangeBg: '#FFF0E6',
  sms: '#34C759',

  text: '#0F172A',
  muted: '#5B6474',
  faint: '#8A93A3',
  border: '#E3E7ED',
  inputBorder: '#7A7F87',
  inputBg: '#F4F7FB',
  bg: '#F4F6F9',
  card: '#FFFFFF',
  subtle: '#F1F4F8',
};

export const font = { small: 14, body: 17, large: 21, title: 28, huge: 34 };

export const radius = { sm: 10, md: 14, lg: 20, pill: 999 };

export const shadow: ViewStyle = Platform.select({
  ios: { shadowColor: '#0B2545', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  default: { elevation: 2 },
}) as ViewStyle;

export type Tone = 'red' | 'amber' | 'blue' | 'green' | 'purple' | 'orange' | 'navy' | 'neutral';

export const tones: Record<Tone, { fg: string; bg: string }> = {
  red: { fg: colors.red, bg: colors.redBg },
  amber: { fg: colors.amber, bg: colors.amberBg },
  blue: { fg: colors.blue, bg: colors.blueBg },
  green: { fg: colors.green, bg: colors.greenBg },
  purple: { fg: colors.purple, bg: colors.purpleBg },
  orange: { fg: colors.orange, bg: colors.orangeBg },
  navy: { fg: colors.navy, bg: '#E6ECF5' },
  neutral: { fg: colors.muted, bg: colors.subtle },
};
