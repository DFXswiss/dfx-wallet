import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';

import { FEATURES } from '@/config/features';
import { ThemeProvider } from '@/theme';

const mockPush = jest.fn();
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// eslint-disable-next-line import/first
import { WalletActions } from '../../src/features/portfolio/WalletActions';

function renderActions(asset?: string) {
  return render(
    <ThemeProvider>
      <WalletActions {...(asset ? { asset } : {})} />
    </ThemeProvider>,
  );
}

describe('WalletActions', () => {
  beforeEach(() => {
    mockPush.mockReset();
  });

  it('shows four actions and routes each action when buy/sell is enabled', () => {
    const { getByTestId } = renderActions('BTC');

    fireEvent.press(getByTestId('wallet-action-receive'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/receive');

    fireEvent.press(getByTestId('wallet-action-send'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/send');

    fireEvent.press(getByTestId('wallet-action-buy'));
    expect(mockPush).toHaveBeenLastCalledWith({
      pathname: '/(auth)/buy',
      params: { asset: 'BTC' },
    });

    fireEvent.press(getByTestId('wallet-action-payout'));
    expect(mockPush).toHaveBeenLastCalledWith('/(auth)/sell');
  });

  it('omits the asset parameter when no asset is provided', () => {
    const { getByTestId } = renderActions();
    fireEvent.press(getByTestId('wallet-action-buy'));
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/(auth)/buy', params: {} });
  });

  it('shows only receive and send when buy/sell is disabled', () => {
    const replaced = jest.replaceProperty(FEATURES, 'BUY_SELL', false);
    try {
      const { getByTestId, queryByTestId } = renderActions('BTC');
      expect(getByTestId('wallet-action-receive')).toBeTruthy();
      expect(getByTestId('wallet-action-send')).toBeTruthy();
      expect(queryByTestId('wallet-action-buy')).toBeNull();
      expect(queryByTestId('wallet-action-payout')).toBeNull();
    } finally {
      replaced.restore();
    }
  });
});
