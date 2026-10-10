import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, create } from 'react-test-renderer';

import type { CommunityAlert } from '../src/core/alerts';
import { localFeed, postAlert, supabaseFeed, useEmergencyAlert, useNearbyAlerts, type AlertsState, type EmergencyAlertStatus } from '../src/services/alerts';

jest.mock('@react-native-async-storage/async-storage', () => jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'));
jest.mock('../src/services/config', () => ({ config: { supabaseUrl: 'https://proj.supabase.co', supabaseAnonKey: 'anon-key', demoMode: false } }));
const mockQuickCoords = jest.fn(async () => null as { lat: number; lon: number } | null);
jest.mock('../src/services/notify', () => ({ quickCoords: () => mockQuickCoords() }));
jest.mock('react-native', () => ({
  AppState: { currentState: 'active', addEventListener: (_: string, cb: (s: string) => void) => ((global as any).__appState = cb, { remove: jest.fn() }) },
}));

const HERE = { lat: 25.83, lon: -80.19 };
const fetchMock = jest.fn();
(global as any).fetch = fetchMock;
const reply = (status: number, body: unknown) => fetchMock.mockResolvedValueOnce({ ok: status < 300, status, json: async () => body });
const row = (id: string, over: object = {}) => ({ id, created_at: new Date().toISOString(), situation: 'fire_gas', urgency: 'emergency', lat: 25.84, lon: -80.19, mine: false, ...over });

beforeEach(async () => {
  await AsyncStorage.clear();
  fetchMock.mockReset();
});

describe('posting to the server', () => {
  test('sends only the allowed fields to the post_alert function, with the anon key', async () => {
    reply(200, 'new-id');
    expect(await postAlert({ urgency: 'emergency', situation: 'fire_gas', coords: { lat: 25.8327, lon: -80.1946 } })).toBe('posted');
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://proj.supabase.co/rest/v1/rpc/post_alert');
    expect(init.headers.apikey).toBe('anon-key');
    const body = JSON.parse(init.body);
    expect(Object.keys(body).sort()).toEqual(['p_device', 'p_lat', 'p_lon', 'p_situation', 'p_urgency']);
    expect(body).toMatchObject({ p_situation: 'fire_gas', p_urgency: 'emergency', p_lat: 25.83, p_lon: -80.19 });
  });

  test('tells the resident when the server says they posted too many', async () => {
    reply(400, { message: 'rate_limited' });
    expect(await postAlert({ urgency: 'urgent_safety', situation: 'downed_line', coords: HERE })).toBe('rate_limited');
  });

  test('any other failure, or no connection, is a plain error', async () => {
    reply(500, { message: 'boom' });
    expect(await postAlert({ urgency: 'emergency', situation: 'other', coords: HERE })).toBe('error');
    fetchMock.mockRejectedValueOnce(new Error('offline'));
    expect(await postAlert({ urgency: 'emergency', situation: 'other', coords: HERE })).toBe('error');
  });
});

describe('asking for nearby alerts', () => {
  test('maps the server rows', async () => {
    reply(200, [row('a', { mine: true })]);
    const [a] = await supabaseFeed.nearby(HERE);
    expect(a).toEqual({ id: 'a', urgency: 'emergency', situation: 'fire_gas', coords: { lat: 25.84, lon: -80.19 }, at: expect.any(String), mine: true });
    expect(fetchMock.mock.calls[0][0]).toBe('https://proj.supabase.co/rest/v1/rpc/nearby_alerts');
  });

  test('throws on a server error so the screen can keep the last good list', async () => {
    reply(503, { message: 'down' });
    await expect(supabaseFeed.nearby(HERE)).rejects.toThrow();
  });
});

describe('local fallback (no server)', () => {
  test('keeps the resident\'s own alert on this phone, marked as theirs', async () => {
    const a: CommunityAlert = { id: 'l1', urgency: 'emergency', situation: 'fire_gas', coords: HERE, at: new Date().toISOString() };
    expect(await localFeed.post(a)).toBe('posted');
    expect(await localFeed.nearby(HERE)).toEqual([{ ...a, mine: true }]);
  });
});

describe('useNearbyAlerts polling', () => {
  let latest: AlertsState;
  const Probe = ({ enabled }: { enabled: boolean }) => {
    latest = useNearbyAlerts(HERE, enabled);
    return null;
  };
  const mount = async (enabled = true) => {
    let r: any;
    await act(async () => {
      r = create(<Probe enabled={enabled} />);
    });
    return r;
  };
  const advance = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('asks right away, then every 5 seconds, and shows what is near', async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => [row('a')] }));
    const r = await mount();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(latest.status).toBe('ok');
    expect(latest.alerts.map((a) => a.id)).toEqual(['a']);
    await advance(4900);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await advance(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await advance(5000);
    expect(fetchMock).toHaveBeenCalledTimes(3);
    await act(async () => r.unmount());
    await advance(20000);
    expect(fetchMock).toHaveBeenCalledTimes(3); // stopped when the screen closed
  });

  test('after a failure it keeps the last alerts, flags the error, and keeps trying', async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: true, status: 200, json: async () => [row('a')] }));
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    fetchMock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => [row('a'), row('b')] }));
    const r = await mount();
    await advance(5100);
    expect(latest.status).toBe('error');
    expect(latest.alerts.map((a) => a.id)).toEqual(['a']);
    await advance(5100);
    expect(latest.status).toBe('ok');
    expect(latest.alerts).toHaveLength(2);
    await act(async () => r.unmount());
  });

  test('does nothing when alerts are switched off', async () => {
    const r = await mount(false);
    await advance(20000);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(latest.status).toBe('idle');
    await act(async () => r.unmount());
  });

  test('pauses in the background and asks again as soon as the app returns', async () => {
    fetchMock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => [] }));
    const r = await mount();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => (global as any).__appState('background'));
    await advance(30000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    await act(async () => (global as any).__appState('active'));
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await act(async () => r.unmount());
  });
});

describe('useEmergencyAlert: an emergency result tells volunteers by itself', () => {
  type Args = Parameters<typeof useEmergencyAlert>[0];
  let status: EmergencyAlertStatus;
  const triageA = {};
  const triageB = {};
  const base: Args = { key: triageA, situation: 'water_in_home', addressCoords: { lat: 25.8327, lon: -80.1946 }, gps: null, online: true, enabled: true };
  // `key` is reserved by React, so the hook's arguments travel inside one prop.
  const Probe = ({ args }: { args: Args }) => {
    status = useEmergencyAlert(args);
    return null;
  };
  const mount = async (p: Args) => {
    let r: any;
    await act(async () => {
      r = create(<Probe args={p} />);
    });
    return r;
  };
  const update = (r: any, p: Args) => act(async () => r.update(<Probe args={p} />));
  const advance = (ms: number) => act(async () => { await jest.advanceTimersByTimeAsync(ms); });
  const posts = () => fetchMock.mock.calls.filter(([u]) => String(u).endsWith('/post_alert'));

  beforeEach(() => {
    jest.useFakeTimers();
    mockQuickCoords.mockClear();
    fetchMock.mockImplementation(async () => ({ ok: true, status: 200, json: async () => 'id' }));
  });
  afterEach(() => jest.useRealTimers());

  test('sends one emergency alert, with no button and nothing but the allowed fields', async () => {
    const r = await mount(base);
    expect(posts()).toHaveLength(1);
    const body = JSON.parse(posts()[0][1].body);
    expect(body).toMatchObject({ p_urgency: 'emergency', p_situation: 'water_in_home', p_lat: 25.83, p_lon: -80.19 });
    expect(Object.keys(body).sort()).toEqual(['p_device', 'p_lat', 'p_lon', 'p_situation', 'p_urgency']);
    expect(status).toBe('sent');
    await act(async () => r.unmount());
  });

  test('re-rendering, or answering a question on the same result, never sends it twice', async () => {
    const r = await mount(base);
    await update(r, { ...base });
    await update(r, { ...base, gps: { lat: 1, lon: 2 } });
    await advance(60000);
    expect(posts()).toHaveLength(1);
    await act(async () => r.unmount());
  });

  test('a new emergency result sends a new alert', async () => {
    const r = await mount(base);
    await update(r, { ...base, key: triageB, situation: 'fire_gas' });
    expect(posts()).toHaveLength(2);
    expect(JSON.parse(posts()[1][1].body).p_situation).toBe('fire_gas');
    await act(async () => r.unmount());
  });

  test('sends nothing for a non-emergency result, or when the resident switched it off', async () => {
    const off = await mount({ ...base, enabled: false });
    expect(status).toBe('off');
    const none = await mount({ ...base, key: null, situation: null });
    expect(status).toBe('idle');
    await advance(30000);
    expect(fetchMock).not.toHaveBeenCalled();
    await act(async () => { off.unmount(); none.unmount(); });
  });

  test('with no internet it waits, then sends as soon as the connection returns', async () => {
    const r = await mount({ ...base, online: false });
    expect(status).toBe('waiting');
    expect(fetchMock).not.toHaveBeenCalled();
    await update(r, { ...base, online: true });
    expect(posts()).toHaveLength(1);
    expect(status).toBe('sent');
    await act(async () => r.unmount());
  });

  test('after a failure it tries again, and stops once the server has it', async () => {
    fetchMock.mockImplementationOnce(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    const r = await mount(base);
    expect(status).toBe('retrying');
    await advance(10100);
    expect(posts()).toHaveLength(2);
    expect(status).toBe('sent');
    await advance(60000);
    expect(posts()).toHaveLength(2);
    await act(async () => r.unmount());
  });

  test('gives up after a few failures instead of hammering the server', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 503, json: async () => ({}) }));
    const r = await mount(base);
    await advance(120000);
    expect(posts()).toHaveLength(4);
    expect(status).toBe('retrying');
    await act(async () => r.unmount());
  });

  test('hitting the hourly limit is reported, not retried', async () => {
    fetchMock.mockImplementation(async () => ({ ok: false, status: 400, json: async () => ({ message: 'rate_limited' }) }));
    const r = await mount(base);
    await advance(60000);
    expect(posts()).toHaveLength(1);
    expect(status).toBe('limited');
    await act(async () => r.unmount());
  });

  test('with no saved address it uses the phone location, asking for a quick fix only when it has none', async () => {
    const r = await mount({ ...base, addressCoords: undefined, gps: { lat: 25.7617, lon: -80.1918 } });
    expect(JSON.parse(posts()[0][1].body)).toMatchObject({ p_lat: 25.76, p_lon: -80.19 });
    expect(mockQuickCoords).not.toHaveBeenCalled();
    await act(async () => r.unmount());
  });

  test('with no location at all nothing is sent, and it keeps trying', async () => {
    const r = await mount({ ...base, addressCoords: undefined, gps: null });
    expect(posts()).toHaveLength(0);
    expect(status).toBe('retrying');
    mockQuickCoords.mockResolvedValueOnce({ lat: 25.8, lon: -80.2 });
    await advance(10100);
    expect(posts()).toHaveLength(1);
    expect(status).toBe('sent');
    await act(async () => r.unmount());
  });
});
