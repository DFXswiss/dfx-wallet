import React from 'react';
import { render } from '@testing-library/react-native';

// `Redirect` from expo-router renders nothing observable in @testing-library,
// so the assertion strategy is: each stub component is a function that
// renders a Redirect with the expected href. We mock `Redirect` to render
// the href as a string we can `getByText` against.
jest.mock('expo-router', () => ({
  Redirect: ({ href }: { href: string }) => {
    const { Text } = jest.requireActual('react-native');
    return <Text testID="redirect-to">{href}</Text>;
  },
  useRouter: () => ({ replace: jest.fn() }),
}));

// `expo-router` mock has to be in place before importing the stubs.
import LegalDisabled from '../../src/features/legal/LegalDisabled';
import MultiSigDisabled from '../../src/features/multi-sig/MultiSigDisabled';
import PayDisabled from '../../src/features/pay/PayDisabled';
import PasskeyDisabled from '../../src/features/passkey/PasskeyDisabled';
import PortfolioDisabled from '../../src/features/portfolio/PortfolioDisabled';
import RestoreDisabled from '../../src/features/restore/RestoreDisabled';
import SettingsDisabled from '../../src/features/settings/SettingsDisabled';
import TaxReportDisabled from '../../src/features/tax-report/TaxReportDisabled';
import TxHistoryDisabled from '../../src/features/tx-history/TxHistoryDisabled';
import WebViewDisabled from '../../src/features/webview/WebViewDisabled';
import BuySellDisabled from '../../src/features/buy-sell/BuySellDisabled';
import DfxBackendDisabled from '../../src/features/dfx-backend/screens/DfxBackendDisabled';
import HardwareWalletDisabled from '../../src/features/hardware-wallet/HardwareWalletDisabled';
import LinkedWalletsDisabled from '../../src/features/linked-wallets/LinkedWalletsDisabled';

describe('feature `*Disabled` stubs all redirect to a safe default route', () => {
  it.each([
    ['LegalDisabled', LegalDisabled, '/(auth)/(tabs)/dashboard'],
    ['MultiSigDisabled', MultiSigDisabled, '/(auth)/(tabs)/dashboard'],
    ['PayDisabled', PayDisabled, '/(auth)/(tabs)/dashboard'],
    ['PasskeyDisabled', PasskeyDisabled, '/(onboarding)/welcome'],
    ['PortfolioDisabled', PortfolioDisabled, '/(auth)/(tabs)/dashboard'],
    ['RestoreDisabled', RestoreDisabled, '/(onboarding)/welcome'],
    ['SettingsDisabled', SettingsDisabled, '/(auth)/(tabs)/dashboard'],
    ['TaxReportDisabled', TaxReportDisabled, '/(auth)/(tabs)/dashboard'],
    ['TxHistoryDisabled', TxHistoryDisabled, '/(auth)/(tabs)/dashboard'],
    ['WebViewDisabled', WebViewDisabled, '/(auth)/(tabs)/dashboard'],
    ['BuySellDisabled', BuySellDisabled, '/(auth)/(tabs)/dashboard'],
    ['DfxBackendDisabled', DfxBackendDisabled, '/(auth)/(tabs)/dashboard'],
    ['HardwareWalletDisabled', HardwareWalletDisabled, '/(auth)/(tabs)/dashboard'],
    ['LinkedWalletsDisabled', LinkedWalletsDisabled, '/(auth)/(tabs)/dashboard'],
  ])('%s redirects to %s', (_name, Stub, expectedHref) => {
    const { getByTestId } = render(<Stub />);
    expect(getByTestId('redirect-to').props.children).toBe(expectedHref);
  });
});
