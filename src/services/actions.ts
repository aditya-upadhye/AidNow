import * as SMS from 'expo-sms';
import { Alert, Linking } from 'react-native';

import { config } from './config';

/**
 * Every outward action goes through here. AidNow never sends anything itself:
 * it opens the dialer or the Messages composer and the resident taps call or send.
 *
 * Demo mode: every number, 911 included, is replaced by the demo recipient. Never call or
 * text 911 while testing; misusing 911 is illegal in Florida.
 */
function target(number: string): string | null {
  if (!config.demoMode) return number;
  if (config.demoRecipient.replace(/\D/g, '') === '911') {
    Alert.alert('AidNow demo', 'The demo number cannot be 911. Nothing was sent.');
    return null;
  }
  return config.demoRecipient;
}

/** What the screen says a call or text goes to. A real demo number is masked: the screen may be projected. */
export function displayTarget(number: string): string {
  if (!config.demoMode) return number;
  const digits = config.demoRecipient.replace(/\D/g, '');
  return digits === '13055550100' || digits === '3055550100' ? '305-555-0100' : `•••${digits.slice(-4)}`;
}

export async function call(number: string): Promise<void> {
  const to = target(number);
  if (!to) return;
  await Linking.openURL(`tel:${to}`);
}

/** Opens the Messages composer prefilled. The resident taps send. */
export async function text(number: string, body: string): Promise<void> {
  const to = target(number);
  if (!to) return;
  if (await SMS.isAvailableAsync()) {
    await SMS.sendSMSAsync([to], body);
  } else {
    await Linking.openURL(`sms:${to}&body=${encodeURIComponent(body)}`);
  }
}
