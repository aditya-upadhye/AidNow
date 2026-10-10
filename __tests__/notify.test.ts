import type { Contact, Profile } from '../src/core/types';
import { notifyStatus, textGroups } from '../src/services/notify';

const mockTextMany = jest.fn();
jest.mock('../src/services/actions', () => ({ textMany: (...a: unknown[]) => mockTextMany(...a) }));
const mockCoords = jest.fn();
jest.mock('../src/services/location', () => ({ getCoords: (...a: unknown[]) => mockCoords(...a) }));

const c = (id: string, phone: string, language: Contact['language']): Contact => ({ id, name: id, phone, language });
const profile = { language: 'ht', fullName: 'Marie Joseph', address: '123 NW 54th St', contacts: [] } as unknown as Profile;

beforeEach(() => {
  mockTextMany.mockReset();
  mockCoords.mockReset().mockResolvedValue({ lat: 25.83271, lon: -80.19468 });
});

describe('textGroups', () => {
  test('one composer per language, each with that language\'s text and only those people', async () => {
    await textGroups([c('a', '1', 'ht'), c('b', '2', 'es'), c('c', '3', 'ht')], (l) => `msg-${l}`);
    expect(mockTextMany.mock.calls).toEqual([
      [['1', '3'], 'msg-ht'],
      [['2'], 'msg-es'],
    ]);
  });
  test('no contacts opens nothing', async () => {
    await textGroups([], () => 'x');
    expect(mockTextMany).not.toHaveBeenCalled();
  });
});

describe('notifyStatus', () => {
  test('writes the SOS text in each contact\'s language, with the address and a map link to the GPS fix', async () => {
    await notifyStatus(profile, [c('a', '1', 'ht'), c('b', '2', 'en')], 'need_help');
    expect(mockTextMany).toHaveBeenCalledTimes(2);
    const [phonesHt, textHt] = mockTextMany.mock.calls[0];
    const [phonesEn, textEn] = mockTextMany.mock.calls[1];
    expect(phonesHt).toEqual(['1']);
    expect(textHt).toContain('Mwen bezwen èd');
    expect(phonesEn).toEqual(['2']);
    expect(textEn).toContain('I need help');
    for (const t of [textHt, textEn]) {
      expect(t).toContain('Marie Joseph');
      expect(t).toContain('123 NW 54th St');
      expect(t.endsWith('https://maps.google.com/?q=25.83271,-80.19468')).toBe(true);
      expect(t).toContain('911');
    }
  });

  test('still sends, with the saved address, when GPS gives nothing', async () => {
    mockCoords.mockResolvedValue(null);
    await notifyStatus(profile, [c('a', '1', 'en')], 'need_help');
    expect(mockTextMany).toHaveBeenCalledTimes(1);
    expect(mockTextMany.mock.calls[0][1]).toContain('123 NW 54th St');
    expect(mockTextMany.mock.calls[0][1]).not.toContain('http');
  });

  test('does not wait forever on a GPS fix that never arrives', async () => {
    jest.useFakeTimers();
    mockCoords.mockReturnValue(new Promise(() => {}));
    const done = notifyStatus(profile, [c('a', '1', 'en')], 'need_help');
    await jest.advanceTimersByTimeAsync(5000);
    await done;
    expect(mockTextMany).toHaveBeenCalledTimes(1);
    jest.useRealTimers();
  });

  test('with no contacts it does nothing at all, not even a GPS lookup', async () => {
    await notifyStatus(profile, [], 'need_help');
    expect(mockCoords).not.toHaveBeenCalled();
    expect(mockTextMany).not.toHaveBeenCalled();
  });
});
