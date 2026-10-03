import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';

jest.mock('expo-router', () => {
  const push = jest.fn();
  return { useRouter: () => ({ push }), __spies: { push } };
});

jest.mock('expo-linking', () => {
  let handler: ((event: { url: string }) => void) | undefined;
  const remove = jest.fn();
  const parse = jest.fn();
  const getInitialURL = jest.fn().mockResolvedValue(null);
  const addEventListener = jest.fn(
    (_event: string, nextHandler: (event: { url: string }) => void) => {
      handler = nextHandler;
      return { remove };
    },
  );
  return {
    addEventListener,
    getInitialURL,
    parse,
    __spies: {
      emit: (url: string) => handler?.({ url }),
      getInitialURL,
      parse,
      remove,
    },
  };
});

import { useDeepLink } from '../../src/features/deep-link/useDeepLinkImpl';

const routerSpies = (
  jest.requireMock('expo-router') as { __spies: { push: jest.Mock } }
).__spies;
const linkingSpies = (
  jest.requireMock('expo-linking') as {
    __spies: {
      emit: (url: string) => void;
      getInitialURL: jest.Mock;
      parse: jest.Mock;
      remove: jest.Mock;
    };
  }
).__spies;

function DeepLinkHarness() {
  useDeepLink();
  return null;
}

describe('useDeepLink', () => {
  beforeEach(() => {
    routerSpies.push.mockReset();
    linkingSpies.getInitialURL.mockReset();
    linkingSpies.getInitialURL.mockResolvedValue(null);
    linkingSpies.parse.mockReset();
    linkingSpies.remove.mockReset();
  });

  it('uses the parsed hostname for dfxwallet://buy links', () => {
    linkingSpies.parse.mockReturnValue({ hostname: 'buy', path: null, queryParams: null });
    render(<DeepLinkHarness />);

    act(() => linkingSpies.emit('dfxwallet://buy'));

    expect(routerSpies.push).toHaveBeenCalledWith('/(auth)/buy');
  });

  it('falls back to the parsed path when no hostname is present', () => {
    linkingSpies.parse.mockReturnValue({ hostname: null, path: 'receive', queryParams: null });
    render(<DeepLinkHarness />);

    act(() => linkingSpies.emit('dfxwallet:///receive'));

    expect(routerSpies.push).toHaveBeenCalledWith('/(auth)/receive');
  });

  it('does not forward query parameters to the send screen', () => {
    linkingSpies.parse.mockReturnValue({
      hostname: 'send',
      path: null,
      queryParams: { amount: '100', to: 'attacker' },
    });
    render(<DeepLinkHarness />);

    act(() => linkingSpies.emit('dfxwallet://send?to=attacker&amount=100'));

    expect(routerSpies.push).toHaveBeenCalledWith('/(auth)/send');
  });

  it('processes the original initial URL returned by Linking', async () => {
    linkingSpies.getInitialURL.mockResolvedValueOnce('dfxwallet://settings');
    linkingSpies.parse.mockReturnValue({ hostname: 'settings', path: null, queryParams: null });

    render(<DeepLinkHarness />);

    await waitFor(() =>
      expect(routerSpies.push).toHaveBeenCalledWith('/(auth)/(tabs)/settings'),
    );
  });

  it('removes the URL listener on unmount', () => {
    const { unmount } = render(<DeepLinkHarness />);
    unmount();
    expect(linkingSpies.remove).toHaveBeenCalledTimes(1);
  });
});
