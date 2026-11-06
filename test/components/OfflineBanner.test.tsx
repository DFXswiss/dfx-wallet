import React from 'react';
import { render } from '@testing-library/react-native';

const mockNetInfo = jest.fn();
jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
jest.mock('@react-native-community/netinfo', () => ({
  useNetInfo: () => mockNetInfo(),
}));

import { OfflineBanner } from '../../src/components/OfflineBanner';

describe('OfflineBanner', () => {
  afterEach(() => {
    mockNetInfo.mockReset();
  });

  it('renders nothing when the device reports `isConnected: true`', () => {
    mockNetInfo.mockReturnValue({ isConnected: true });
    const { queryByText } = render(<OfflineBanner />);
    expect(queryByText('offline.message')).toBeNull();
  });

  it('renders nothing when `isConnected` is null (NetInfo not initialised yet)', () => {
    // Important: the banner must NOT flash during the initial NetInfo
    // probe — only an explicit `false` is treated as "offline".
    mockNetInfo.mockReturnValue({ isConnected: null });
    const { queryByText } = render(<OfflineBanner />);
    expect(queryByText('offline.message')).toBeNull();
  });

  it('shows the offline message when `isConnected: false`', () => {
    mockNetInfo.mockReturnValue({ isConnected: false });
    const { getByText } = render(<OfflineBanner />);
    expect(getByText('offline.message')).toBeTruthy();
  });
});
