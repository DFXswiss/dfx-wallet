import React from 'react';
import { render } from '@testing-library/react-native';
import { dfxAuthService } from '@/features/dfx-backend/services';

const mockParams: { url: string; title?: string } = { url: 'https://app.dfx.swiss' };

jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: jest.fn() }),
}));

jest.mock('react-native-webview', () => {
  const ReactActual = jest.requireActual<typeof import('react')>('react');
  const { View } = jest.requireActual<typeof import('react-native')>('react-native');
  let latestProps: Record<string, unknown> = {};
  return {
    WebView: (props: Record<string, unknown>) => {
      latestProps = props;
      return ReactActual.createElement(View, { testID: 'webview' });
    },
    __getProps: () => latestProps,
  };
});

jest.mock('@/features/dfx-backend/services', () => ({
  dfxAuthService: { getAccessToken: jest.fn(() => 'DFX_TOKEN') },
}));

import WebViewScreen from '../../src/features/webview/WebViewScreenImpl';

const getWebViewProps = (
  jest.requireMock('react-native-webview') as { __getProps: () => Record<string, unknown> }
).__getProps;

describe('WebViewScreenImpl token forwarding', () => {
  beforeEach(() => {
    (dfxAuthService.getAccessToken as jest.Mock).mockClear();
  });

  it('attaches the bearer token to an exact DFX token host', () => {
    mockParams.url = 'https://app.dfx.swiss/account';
    render(<WebViewScreen />);

    expect(getWebViewProps().source).toEqual({
      uri: mockParams.url,
      headers: { Authorization: 'Bearer DFX_TOKEN' },
    });
  });

  it.each(['https://x.app.dfx.swiss', 'https://docs.dfx.swiss/de/tnc.html'])(
    'does not attach the bearer token to %s',
    (url) => {
      mockParams.url = url;
      render(<WebViewScreen />);

      expect(getWebViewProps().source).toEqual({ uri: url });
      expect(dfxAuthService.getAccessToken).not.toHaveBeenCalled();
    },
  );
});
