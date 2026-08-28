import React from 'react';
import { render } from '@testing-library/react-native';

// The other feature routes gate inside pay/index.tsx (PayScreenImpl vs
// PayDisabled), but opencryptopay.tsx is its own Expo Router route and
// carries its own FEATURES.PAY gate. setup-globals pins every flag to
// 'true' for the suite, so force PAY off at the module boundary here to
// exercise the disabled path.
jest.mock('@/config/features', () => ({ FEATURES: { PAY: false } }));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

// Same Redirect probe as IndexRouting.test.tsx: expo-router's Redirect
// renders nothing, so stub it to surface the target href.
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text testID="redirect-target">{href}</Text>;
  },
  useRouter: () => ({ push: jest.fn(), back: jest.fn(), replace: jest.fn() }),
  useLocalSearchParams: () => ({ lnurl: 'LNURL1TESTQR' }),
  Stack: { Screen: () => null },
}));

const mockFetchQuote = jest.fn();
jest.mock('@/services/opencryptopay', () => {
  const actual = jest.requireActual('@/services/opencryptopay');
  return { ...actual, fetchQuote: (...args: unknown[]) => mockFetchQuote(...args) };
});

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children?: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

import OpenCryptoPayRoute from '../../app/(auth)/pay/opencryptopay';

describe('OpenCryptoPayRoute with FEATURES.PAY off', () => {
  it('redirects to the dashboard instead of mounting the quote screen', () => {
    const { getByTestId, queryByTestId } = render(<OpenCryptoPayRoute />);

    expect(getByTestId('redirect-target').props.children).toBe('/(auth)/(tabs)/dashboard');
    expect(queryByTestId('opencryptopay')).toBeNull();
  });

  it('never fires the LNURL quote fetch', () => {
    render(<OpenCryptoPayRoute />);

    expect(mockFetchQuote).not.toHaveBeenCalled();
  });
});
