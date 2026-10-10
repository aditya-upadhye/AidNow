import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

const isUp = (s: { isConnected: boolean | null; isInternetReachable: boolean | null }) =>
  s.isConnected === true && s.isInternetReachable !== false;

/** True when there is an internet connection. Cell signal for calls and texts is separate. */
export function useOnline(): boolean {
  const [online, setOnline] = useState(true);
  useEffect(() => NetInfo.addEventListener((s) => setOnline(isUp(s))), []);
  return online;
}

export async function isOnline(): Promise<boolean> {
  return isUp(await NetInfo.fetch());
}
