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
  try {
    await Linking.openURL(`tel:${to}`);
  } catch {
    // No phone app (e.g. the simulator): show the number so it can be dialed by hand.
    Alert.alert('Call', to);
  }
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

/** Opens Apple Maps with directions to a place. Contacts no one, so it is not redirected in demo mode. */
export async function directions(query: string): Promise<void> {
  try {
    await Linking.openURL(`http://maps.apple.com/?daddr=${encodeURIComponent(query)}`);
  } catch {
    Alert.alert('Directions', query);
  }
}

/** Opens one Messages composer to several people (a family group text). The resident taps send. */
export async function textMany(numbers: string[], body: string): Promise<void> {
  const to = numbers.map(target).filter((n): n is string => !!n);
  if (to.length === 0) return;
  // Demo mode turns every number into the same demo recipient: one composer to one number is enough.
  const unique = [...new Set(to)];
  if (await SMS.isAvailableAsync()) {
    await SMS.sendSMSAsync(unique, body);
  } else {
    await Linking.openURL(`sms:${unique.join(',')}&body=${encodeURIComponent(body)}`);
  }
}
