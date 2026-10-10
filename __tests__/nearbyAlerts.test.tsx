import { act, create } from 'react-test-renderer';

import { NearbyAlerts } from '../src/components/NearbyAlerts';

const mockFocused = { current: true };
jest.mock('expo-router', () => ({ router: { push: jest.fn() }, useIsFocused: () => mockFocused.current }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));
jest.mock('../src/state/AppContext', () => ({ useApp: () => ({ profile: { language: 'en', addressCoords: { lat: 25.83, lon: -80.19 } }, online: true }) }));
jest.mock('../src/services/location', () => ({ getCoords: jest.fn(async () => null) }));
jest.mock('../src/services/config', () => ({ config: { demoMode: false } }));

const mockSettings: { current: any } = { current: null };
const mockLoad = jest.fn(async () => mockSettings.current);
jest.mock('../src/services/storage', () => ({ loadCommunity: () => mockLoad() }));

const mockHook = jest.fn();
const mockState: { current: any } = { current: { alerts: [], status: 'idle', updatedAt: null } };
jest.mock('../src/services/alerts', () => ({
  alertsConfigured: true,
  useNearbyAlerts: (...a: unknown[]) => (mockHook(...a), mockState.current),
}));

const ON = { consented: true, volunteer: true, receiveAlerts: true };
const FIRE = { id: 'a', urgency: 'emergency', situation: 'fire_gas', coords: { lat: 25.85, lon: -80.2 }, at: new Date().toISOString(), km: 2.4 };

const mount = async (quiet: boolean) => {
  let r: any;
  await act(async () => {
    r = create(<NearbyAlerts quiet={quiet} />);
  });
  return r;
};
const text = (r: any) => JSON.stringify(r.toJSON() ?? '');

beforeEach(() => {
  mockFocused.current = true;
  mockSettings.current = null;
  mockState.current = { alerts: [], status: 'idle', updatedAt: null };
  mockHook.mockClear();
  mockLoad.mockClear();
});

describe('NearbyAlerts on the Home page (quiet)', () => {
  test('shows nothing to someone who has not switched alerts on', async () => {
    const r = await mount(true);
    expect(r.toJSON()).toBeNull();
    mockSettings.current = { ...ON, receiveAlerts: false };
    expect((await mount(true)).toJSON()).toBeNull();
    mockSettings.current = { ...ON, volunteer: false };
    expect((await mount(true)).toJSON()).toBeNull();
  });

  test('does not need the "be visible" consent: receiving alerts publishes nothing about you', async () => {
    mockSettings.current = { ...ON, consented: false };
    expect(text(await mount(true))).toContain('city.alerts.title');
  });

  test('shows the live alert to a volunteer who switched alerts on', async () => {
    mockSettings.current = ON;
    mockState.current = { alerts: [FIRE], status: 'ok', updatedAt: new Date() };
    const r = await mount(true);
    expect(text(r)).toContain('city.alerts.title');
    expect(text(r)).toContain('city.alerts.liveBadge');
    expect(text(r)).toContain('Fire or gas smell');
    expect(text(r)).toContain('city.alerts.emergency');
  });

  test('polls only while the Home tab is in front', async () => {
    mockSettings.current = ON;
    mockFocused.current = false;
    await mount(true);
    expect(mockHook.mock.calls.every(([, enabled]) => enabled === false)).toBe(true);
    expect(mockLoad).not.toHaveBeenCalled();
    mockHook.mockClear();
    mockFocused.current = true;
    await mount(true);
    expect(mockHook.mock.calls.some(([, enabled]) => enabled === true)).toBe(true);
  });

  test('re-reads the switches when the resident comes back to the tab', async () => {
    let r: any;
    await act(async () => {
      r = create(<NearbyAlerts quiet />);
    });
    expect(r.toJSON()).toBeNull(); // off at first
    mockFocused.current = false;
    await act(async () => r.update(<NearbyAlerts quiet />));
    mockSettings.current = ON; // switched on in My role meanwhile
    mockFocused.current = true;
    await act(async () => r.update(<NearbyAlerts quiet />));
    expect(text(r)).toContain('city.alerts.title');
  });
});

describe('NearbyAlerts in the City view (not quiet)', () => {
  test('tells someone who has not switched alerts on how to do it', async () => {
    const r = await mount(false);
    expect(text(r)).toContain('city.alerts.offTitle');
  });
});
