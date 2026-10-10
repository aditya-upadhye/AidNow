import { act, create } from 'react-test-renderer';

import { SosButton } from '../src/components/SosButton';

const mockCall = jest.fn();
jest.mock('../src/services/actions', () => ({ call: (n: string) => mockCall(n), displayTarget: () => '305-555-0100' }));
const mockProfile: { current: any } = { current: { address: '123 NW 54th St, Miami' } };
jest.mock('../src/state/AppContext', () => ({ useApp: () => ({ profile: mockProfile.current }) }));
const mockNotify = jest.fn();
jest.mock('../src/services/notify', () => ({ notifyStatus: (...a: unknown[]) => mockNotify(...a) }));
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (p: string) => mockPush(p) } }));
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));
jest.mock('expo-haptics', () => ({ notificationAsync: jest.fn(), NotificationFeedbackType: { Warning: 'warning' } }));
jest.mock('react-native-safe-area-context', () => ({ SafeAreaView: ({ children }: any) => children }));
jest.mock('@expo/vector-icons', () => ({ Ionicons: () => null }));

const find = (r: any, id: string) => r.root.findAll((n: any) => n.props.testID === id && (typeof n.props.onPress === 'function' || typeof n.props.onAccessibilityAction === 'function'))[0];

const mount = async () => {
  let r: any;
  await act(async () => {
    r = create(<SosButton />);
  });
  return r;
};

describe('SosButton', () => {
  beforeEach(() => {
    mockCall.mockClear();
    mockNotify.mockClear();
    mockPush.mockClear();
    mockProfile.current = { address: '123 NW 54th St, Miami' };
  });

  it('does not dial on the first tap, only opens the confirmation', async () => {
    const r = await mount();
    await act(async () => find(r, 'sos-button').props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
    expect(mockCall).not.toHaveBeenCalled();
    expect(find(r, 'sos-call')).toBeTruthy();
  });

  it('dials 911 when the big call button is pressed', async () => {
    const r = await mount();
    await act(async () => find(r, 'sos-button').props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
    await act(async () => find(r, 'sos-call').props.onPress());
    expect(mockCall).toHaveBeenCalledTimes(1);
    expect(mockCall).toHaveBeenCalledWith('911');
  });

  it('cancel closes without dialing', async () => {
    const r = await mount();
    await act(async () => find(r, 'sos-button').props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
    await act(async () => find(r, 'sos-cancel').props.onPress());
    expect(mockCall).not.toHaveBeenCalled();
    expect(find(r, 'sos-call')).toBeUndefined();
  });

  describe('emergency contacts', () => {
    const contacts = [
      { id: 'a', name: 'Jean', phone: '3055550101', language: 'ht' },
      { id: 'b', name: 'Rosa', phone: '3055550102', language: 'es' },
    ];

    it('texts every saved contact with a "need help" status, and never touches 911', async () => {
      mockProfile.current = { address: '123 NW 54th St, Miami', fullName: 'Marie', contacts };
      const r = await mount();
      await act(async () => find(r, 'sos-button').props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
      await act(async () => find(r, 'sos-notify').props.onPress());
      expect(mockNotify).toHaveBeenCalledTimes(1);
      expect(mockNotify).toHaveBeenCalledWith(mockProfile.current, contacts, 'need_help');
      expect(mockCall).not.toHaveBeenCalled();
    });

    it('with no contacts it offers to add some, instead of a notify button', async () => {
      const r = await mount();
      await act(async () => find(r, 'sos-button').props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
      expect(find(r, 'sos-notify')).toBeUndefined();
      await act(async () => find(r, 'sos-add-contacts').props.onPress());
      expect(mockPush).toHaveBeenCalledWith('/family');
      expect(mockNotify).not.toHaveBeenCalled();
    });

    it('the 911 call button is still there and still works alongside the contact button', async () => {
      mockProfile.current = { address: 'x', fullName: 'Marie', contacts };
      const r = await mount();
      await act(async () => find(r, 'sos-button').props.onAccessibilityAction({ nativeEvent: { actionName: 'activate' } }));
      expect(find(r, 'sos-notify')).toBeTruthy();
      await act(async () => find(r, 'sos-call').props.onPress());
      expect(mockCall).toHaveBeenCalledWith('911');
    });
  });
});
