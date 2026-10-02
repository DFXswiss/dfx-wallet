import React from 'react';
import * as Haptics from 'expo-haptics';
import { act, fireEvent, render, within } from '@testing-library/react-native';
import { bech32, bech32m } from 'bech32';
import bs58check from 'bs58check';
import { getIcapAddress, ZeroAddress } from 'ethers';
import Svg, { Path } from 'react-native-svg';
import { darkColors, ThemeProvider, useThemeStore } from '@/theme';
import { Linking, Share } from 'react-native';
import { Linking, Share, StyleSheet } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import { act, fireEvent, render } from '@testing-library/react-native';
import { useAccount } from '@tetherto/wdk-react-native-core';

jest.mock('react-native-mmkv', () => {
  const store = new Map<string, string>();
  return {
    createMMKV: () => ({
      getString: (key: string) => store.get(key),
      set: (key: string, value: string) => {
        store.set(key, value);
      },
    }),
    __store: store,
  };
});

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) =>
      params ? `${key}:${JSON.stringify(params)}` : key,
  }),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

const mockPush = jest.fn();
const mockBack = jest.fn();
const mockUsePreventRemove = jest.fn();
jest.mock('@react-navigation/native', () => ({
  usePreventRemove: (preventRemove: boolean, callback: () => void) =>
    mockUsePreventRemove(preventRemove, callback),
const mockSearchParams: {
  current: { address?: string; amount?: string; query?: string };
} = { current: {} };
jest.mock('expo-router', () => ({
  useLocalSearchParams: () => mockSearchParams.current,
  useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
  Stack: { Screen: () => null },
}));

const mockStackScreenOptions: { current: { gestureEnabled?: boolean } | null } = { current: null };
jest.mock('expo-router', () => {
  function MockStackScreen({ options }: { options: { gestureEnabled?: boolean } }) {
    mockStackScreenOptions.current = options;
    return null;
  }

  return {
    useRouter: () => ({ push: mockPush, back: mockBack, replace: jest.fn(), canGoBack: () => true }),
    Stack: { Screen: MockStackScreen },
  };
});
jest.mock('expo-clipboard', () => ({
  setStringAsync: jest.fn(async () => true),
  getStringAsync: jest.fn(async () => ''),
}));

jest.mock('react-native-qrcode-svg', () => 'QRCode');

// Send screen consumes `useSendFlow` directly; mock the public re-export so
// the test never touches `useAccount` / WDK and we can drive the flow's
// state (estimate result, send result, error, isLoading) per test.
const mockSend = jest.fn();
const mockEstimate = jest.fn();
const mockReset = jest.fn();
const mockUseSendFlow = jest.fn();
const flowState: {
  isLoading: boolean;
  txHash: string | null;
  error: string | null;
} = { isLoading: false, txHash: null, error: null };

jest.mock('@/hooks', () => ({
  useSendFlow: (chain: string) => {
    mockUseSendFlow(chain);
    return {
      send: mockSend,
      estimate: mockEstimate,
      reset: mockReset,
      isLoading: flowState.isLoading,
      txHash: flowState.txHash,
      error: flowState.error,
    };
  },
  useLdsWallet: () => ({
    user: null,
    isLoading: false,
    error: null,
    signIn: jest.fn(),
  }),
  useSendFlow: () => ({
    send: mockSend,
    estimate: mockEstimate,
    reset: mockReset,
    isLoading: flowState.isLoading,
    txHash: flowState.txHash,
    error: flowState.error,
  }),
}));

// Balances and prices are inputs of the screen, not part of it: the tests set
// them per case.
type MockBalance = { assetId: string; rawBalance: string; status: 'ok' | 'loading' };
const mockBalances = new Map<string, MockBalance>();
jest.mock('@/services/balances', () => ({
  useBalances: () => ({ data: mockBalances, isLoading: false, error: null }),
  getRawBalance: (map: ReadonlyMap<string, MockBalance>, id: string) =>
    map.get(id)?.rawBalance ?? '0',
}));

const mockRates = new Map<string, number>();
jest.mock('@/services/pricing-service', () => ({
  FiatCurrency: { USD: 'USD', CHF: 'CHF', EUR: 'EUR' },
  pricingService: {
    isReady: () => true,
    initialize: async () => undefined,
    getExchangeRate: (ticker: string, currency: string) => mockRates.get(`${ticker}:${currency}`),
  },
}));

const mockBankAccounts: { current: { id: number; iban: string; label?: string }[] } = {
  current: [],
};
jest.mock('@/features/transfer/useBankAccounts', () => ({
  useBankAccounts: () => mockBankAccounts.current,
}));

// ScannerView owns the camera UI; these tests exercise the Send screen's
// modal and callbacks while ScannerView has its own component suite.
const mockScannerProps: {
  onScan: ((value: string) => boolean) | null;
  onClose: (() => void) | null;
  onOpenSettings: (() => void) | null;
} = { onScan: null, onClose: null, onOpenSettings: null };
jest.mock('@/features/scan/ScannerView', () => {
  const { View } = jest.requireActual('react-native');
  return {
    ScannerView: (props: {
      onScan: (value: string) => boolean;
      onClose: () => void;
      onOpenSettings: () => void;
    }) => {
      mockScannerProps.onScan = props.onScan;
      mockScannerProps.onClose = props.onClose;
      mockScannerProps.onOpenSettings = props.onOpenSettings;
      return <View testID="scanner-view" />;
    },
  };
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

// eslint-disable-next-line import/first
import SendScreen from '../../app/(auth)/send/index';
// eslint-disable-next-line import/first
import { getSendAssetForCanonical } from '../../src/config/tokens';
// eslint-disable-next-line import/first
import { useAddressBookStore, type Contact } from '../../src/store/address-book';
// eslint-disable-next-line import/first
import { Typography } from '../../src/theme';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
const OWN = `bc1q${'a'.repeat(38)}`;
// BIP-173 reference address (whitelisted fixture, see eslint.config.js).
const BTC_ADDR = 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq';
const EVM_ADDR = `0x${'ab12'.repeat(10)}`;
const EVM_ADDR_2 = `0x${'cd34'.repeat(10)}`;
const EVM_ADDR_3 = `0x${'ef56'.repeat(10)}`;

// eslint-disable-next-line no-secrets/no-secrets -- public BIP-173 test vector, not a credential
const RECIPIENT = 'bc1qw508d6qejxtdg4y5r3zarvary0c5xw7kv8f3t4';
const SPARK_IDENTITY_PUBLIC_KEY_HEX =
  '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798';
const SPARK_IDENTITY_PUBLIC_KEY = Uint8Array.from(
  { length: SPARK_IDENTITY_PUBLIC_KEY_HEX.length / 2 },
  (_, index) =>
    Number.parseInt(SPARK_IDENTITY_PUBLIC_KEY_HEX.slice(index * 2, index * 2 + 2), 16),
);
const SPARK_RECIPIENT = bech32m.encode(
  'spark',
  bech32m.toWords(Uint8Array.from([0x0a, 0x21, ...SPARK_IDENTITY_PUBLIC_KEY])),
  1023,
);
const EVM_RECIPIENT = '0x52908400098527886E0F7030069857D2E4169EE7';
const LOWERCASE_EVM_RECIPIENT = EVM_RECIPIENT.toLowerCase();
const WRONG_CHECKSUM_EVM_RECIPIENT = `${EVM_RECIPIENT.slice(0, -2)}e7`;
const TESTNET_BECH32_RECIPIENT = bech32.encode('tb', [
  0,
  ...bech32.toWords(new Uint8Array(20)),
]);
const TESTNET_P2PKH_M_RECIPIENT = bs58check.encode(
  Uint8Array.from([0x6f, ...new Uint8Array(20)]),
);
const TESTNET_P2PKH_N_RECIPIENT = bs58check.encode(
  Uint8Array.from([0x6f, ...new Uint8Array(20).fill(0xff)]),
);
const TESTNET_P2SH_RECIPIENT = bs58check.encode(
  Uint8Array.from([0xc4, ...new Uint8Array(20)]),
);

function fillRecipientAndAmount(
  getByPlaceholderText: ReturnType<typeof render>['getByPlaceholderText'],
  recipient = RECIPIENT,
) {
  fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), recipient);
  fireEvent.changeText(getByPlaceholderText('0.00'), '1');
}
const ANNA: Contact = {
  id: 'c-anna',
  name: 'Anna',
  address: BTC_ADDR,
  chain: 'spark',
  assetSymbol: 'BTC',
  createdAt: 1,
  lastUsedAt: NOW - 2 * DAY,
};
const MARCO: Contact = {
  id: 'c-marco',
  name: 'Marco',
  address: EVM_ADDR,
  chain: 'polygon',
  assetSymbol: 'CHF',
  createdAt: 2,
  lastUsedAt: NOW - 5 * DAY,
};
const LEA: Contact = {
  id: 'c-lea',
  name: 'Lea',
  address: EVM_ADDR_2,
  chain: 'ethereum',
  assetSymbol: 'EUR',
  createdAt: 3,
};
const TIM: Contact = {
  id: 'c-tim',
  name: 'Tim',
  address: EVM_ADDR_3,
  chain: 'base',
  assetSymbol: 'USD',
  createdAt: 4,
};

const mmkvMemory = (jest.requireMock('react-native-mmkv') as { __store: Map<string, string> })
  .__store;

type Screen = ReturnType<typeof render>;

const seedContacts = (...contacts: Contact[]) => {
  useAddressBookStore.setState({ contacts, hydrated: true });
};

const setBtcBalance = (rawBalance: string) => {
  const id = getSendAssetForCanonical('BTC', 'spark')!.getId();
  mockBalances.set(id, { assetId: id, rawBalance, status: 'ok' });
};

const typeAmount = (screen: Screen, digits: string) => {
  for (const char of digits) {
    fireEvent.press(screen.getByTestId(char === '.' ? 'amount-key-dot' : `amount-key-${char}`));
  }
};

const unitIds = (screen: Screen) =>
  screen.getAllByTestId(/^send-unit-[A-Z]{3}$/).map((node) => node.props.testID as string);

const tap = async (screen: Screen, testID: string) => {
  await act(async () => {
    fireEvent.press(screen.getByTestId(testID));
  });
};

/** Overview -> amount step for a contact, with `digits` typed (in `unit` if given). */
const openAmount = (screen: Screen, contact: Contact, digits = '', unit?: string) => {
  fireEvent.press(screen.getByTestId(`send-contact-${contact.id}`));
  if (unit) fireEvent.press(screen.getByTestId(`send-unit-${unit}`));
  typeAmount(screen, digits);
};

const openConfirm = async (screen: Screen, contact: Contact, digits: string, unit?: string) => {
  openAmount(screen, contact, digits, unit);
  await tap(screen, 'send-continue-button');
};

describe('SendScreen', () => {
  beforeEach(() => {
    mockPush.mockReset();
    mockBack.mockReset();
    mockUsePreventRemove.mockClear();
    mockSend.mockReset();
    mockEstimate.mockReset();
    mockEstimate.mockResolvedValue({ success: true, fee: '21000' });
    mockReset.mockReset();
    mockUseSendFlow.mockReset();
    (Haptics.notificationAsync as jest.Mock).mockReset();
    flowState.isLoading = false;
    flowState.txHash = null;
    flowState.error = null;
    useThemeStore.setState({ mode: 'light' });
    mockStackScreenOptions.current = null;
    qrScannerProps.visible = false;
    qrScannerProps.onScan = null;
    qrScannerProps.onClose = null;
    mockScannerProps.onScan = null;
    mockScannerProps.onClose = null;
    mockScannerProps.onOpenSettings = null;
    mockSearchParams.current = {};
    mockBalances.clear();
    mockRates.clear();
    mockRates.set('btc:CHF', 61000);
    mockRates.set('btc:EUR', 57000);
    mockRates.set('zchf:EUR', 1.05);
    mockRates.set('deuro:CHF', 0.95);
    mockRates.set('usdt:CHF', 0.8);
    mockRates.set('usdt:EUR', 0.85);
    mockBankAccounts.current = [];
    mmkvMemory.clear();
    (useAccount as jest.Mock).mockReturnValue({ address: OWN });
    (Clipboard.setStringAsync as jest.Mock).mockClear();
    (Clipboard.getStringAsync as jest.Mock).mockClear();
    seedContacts();
  });

  describe('overview', () => {
    it('shows the empty state on a first start', () => {
      const screen = render(<SendScreen />);
      expect(screen.getByTestId('send-screen')).toBeTruthy();
      expect(screen.getByText('send.overviewTitle')).toBeTruthy();
      expect(screen.getByText('send.overviewSubtitleEmpty')).toBeTruthy();
      expect(screen.getByText('send.contactsLabel:{"count":0}')).toBeTruthy();
      expect(screen.getByTestId('send-contacts-empty')).toBeTruthy();
      expect(screen.getByText('send.contactsEmpty')).toBeTruthy();
      expect(screen.getByText('send.accountsLabel:{"count":1}')).toBeTruthy();
      expect(screen.getByTestId('send-account-dfx')).toBeTruthy();
      expect(screen.getByTestId('send-account-bank-add')).toBeTruthy();
      expect(
        screen
          .getAllByTestId(/^send-account-(?:bank|dfx)/)
          .map((row) => row.props.testID as string),
      ).toEqual(['send-account-bank-add', 'send-account-dfx']);
      expect(screen.getByText('send.accountBankAddHint')).toBeTruthy();
      expect(screen.queryByTestId('send-contact-new')).toBeNull();
    });

    it('lists contacts most recently used first, with an accent ring on the first only', () => {
      seedContacts(LEA, MARCO, ANNA);
      const screen = render(<SendScreen />);
      const ids = screen.getAllByTestId(/^send-contact-c-/).map((n) => n.props.testID);
      expect(ids).toEqual(['send-contact-c-anna', 'send-contact-c-marco', 'send-contact-c-lea']);
      expect(screen.getByText('send.overviewSubtitle')).toBeTruthy();
      expect(screen.getByText('send.contactsLabel:{"count":3}')).toBeTruthy();
      expect(screen.getAllByTestId('contact-avatar-ring')).toHaveLength(1);
      expect(screen.getByTestId('send-contact-new')).toBeTruthy();
      expect(screen.queryByTestId('send-contacts-empty')).toBeNull();
    });

    it('loads the persisted contacts on mount', () => {
      mmkvMemory.set('addressBook', JSON.stringify([ANNA]));
      useAddressBookStore.setState({ contacts: [], hydrated: false });
      const screen = render(<SendScreen />);
      expect(screen.getByTestId('send-contact-c-anna')).toBeTruthy();
      expect(useAddressBookStore.getState().hydrated).toBe(true);
    });

    it('filters the contacts by name or address while typing', () => {
      seedContacts(ANNA, MARCO);
      const screen = render(<SendScreen />);
      fireEvent.changeText(screen.getByTestId('send-recipient-input'), 'mar');
      expect(screen.queryByTestId('send-contact-c-anna')).toBeNull();
      expect(screen.getByTestId('send-contact-c-marco')).toBeTruthy();
      expect(screen.getByText('send.contactsLabel:{"count":1}')).toBeTruthy();

      fireEvent.changeText(screen.getByTestId('send-recipient-input'), 'BC1QAR0');
      expect(screen.getByTestId('send-contact-c-anna')).toBeTruthy();
      expect(screen.queryByTestId('send-contact-c-marco')).toBeNull();
    });

  describe('input step', () => {
    it('enables Continue for a Spark mainnet BTC recipient', () => {
      const { getByPlaceholderText, getByTestId, getByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).toBe(true);
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), SPARK_RECIPIENT);
      fireEvent.changeText(getByPlaceholderText('0.00'), '1');
      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).not.toBe(true);
    });

    it('keeps Continue disabled for a checksum-mutated mainnet BTC recipient', () => {
      const invalidRecipient = `${RECIPIENT.slice(0, -1)}q`;
      const { getByPlaceholderText, getByTestId, getByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), invalidRecipient);
      fireEvent.changeText(getByPlaceholderText('0.00'), '1');

      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).toBe(true);
    });

    it.each([
      TESTNET_BECH32_RECIPIENT,
      TESTNET_P2PKH_M_RECIPIENT,
      TESTNET_P2PKH_N_RECIPIENT,
      TESTNET_P2SH_RECIPIENT,
    ])('keeps Continue disabled for testnet BTC recipient %s', (address) => {
      const { getByPlaceholderText, getByTestId, getByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), address);
      fireEvent.changeText(getByPlaceholderText('0.00'), '1');
      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).toBe(true);

      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), SPARK_RECIPIENT);
      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).not.toBe(true);
    });

    it.each([
      ['checksummed', EVM_RECIPIENT],
      ['lowercase', LOWERCASE_EVM_RECIPIENT],
    ])('enables Continue for a valid %s EVM recipient', (_label, address) => {
      const { getAllByText, getByPlaceholderText, getByTestId } = render(<SendScreen />);
      fireEvent.press(getAllByText('CHF')[0]!);
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), address);
      fireEvent.changeText(getByPlaceholderText('0.00'), '1');

      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).not.toBe(true);
    });

    it.each([
      ['wrong-checksum mixed-case', WRONG_CHECKSUM_EVM_RECIPIENT],
      ['too short', '0x1234'],
    ])('keeps Continue disabled for a %s EVM recipient', (_label, address) => {
      const { getAllByText, getByPlaceholderText, getByTestId } = render(<SendScreen />);
      fireEvent.press(getAllByText('CHF')[0]!);
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), address);
      fireEvent.changeText(getByPlaceholderText('0.00'), '1');

      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).toBe(true);
    });

    it.each([
      '0x0000000000000000000000000000000000000000',
      '0000000000000000000000000000000000000000',
      getIcapAddress(ZeroAddress),
    ])('keeps Continue disabled for the zero EVM address %s', (address) => {
      const { getAllByText, getByPlaceholderText, getByTestId } = render(<SendScreen />);
      fireEvent.press(getAllByText('CHF')[0]!);
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), address);
      fireEvent.changeText(getByPlaceholderText('0.00'), '1');

      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).toBe(true);
    });

    it('keeps Continue disabled when the amount exceeds the asset precision', () => {
      const { getAllByText, getByPlaceholderText, getByTestId } = render(<SendScreen />);
      fireEvent.press(getAllByText('CHF')[0]!);
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), EVM_RECIPIENT);

      // Every configured CHF send asset is ZCHF with 18 decimals.
      fireEvent.changeText(getByPlaceholderText('0.00'), '1.123456789012345678');
      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).not.toBe(true);

      fireEvent.changeText(getByPlaceholderText('0.00'), '1.1234567890123456789');
      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).toBe(true);
      expect(mockEstimate).not.toHaveBeenCalled();
    });

    it('renders the chain bar with multiple chains when the asset has >1 chain', () => {
      const { getByText } = render(<SendScreen />);
      // CHF has 4 EVM chains — picking it should render the chain bar.
      fireEvent.press(getAllByText('CHF')[0]!);
      fireEvent.press(getByText('CHF'));
      expect(getByText('Ethereum')).toBeTruthy();
      expect(getByText('Arbitrum')).toBeTruthy();
      expect(getByText('Polygon')).toBeTruthy();
      expect(getByText('Base')).toBeTruthy();
    });

    it('switches the selected chain when a different chip is pressed', () => {
      const { getAllByText, getByText } = render(<SendScreen />);
      fireEvent.press(getAllByText('CHF')[0]!);
      const { getByText } = render(<SendScreen />);
      fireEvent.press(getByText('CHF'));
      // Default is the first chain (Ethereum). Tap Polygon — the chain
      // switches but stays in the input step.
      fireEvent.press(getByText('Polygon'));
      expect(getByText('common.continue')).toBeTruthy();
    });

    it('opens the QR scanner when "scan" is pressed', () => {
      const { getByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      // The scanner is mocked to null but the press must not throw.
      expect(() => fireEvent.press(getByText('send.scan'))).not.toThrow();
    });

    it('navigates to /(auth)/sell when the "sell instead" shortcut is pressed', () => {
      const { getByTestId, getByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fireEvent.press(getByTestId('send-action-sell'));
      expect(mockPush).toHaveBeenCalledWith('/(auth)/sell');
    });
  });

  describe('confirm step', () => {
    it('transitions to confirm after a successful estimate and shows the formatted fee', async () => {
      mockEstimate.mockResolvedValueOnce({ success: true, fee: '1234' });
      const { getByText, getByPlaceholderText, getByTestId, findByText } = render(
        <SendScreen />,
      );
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });
      // Confirm-step title is `send.confirmTransaction`.
      expect(await findByText('send.confirmTransaction')).toBeTruthy();
      expect(mockEstimate).toHaveBeenCalledWith(
        expect.objectContaining({ to: RECIPIENT, amount: '1' }),
      );
      expect(getByText('send.networkFee')).toBeTruthy();
      expect(getByText('0.00001234 BTC')).toBeTruthy();
      expect(getByText('Bitcoin (SegWit)')).toBeTruthy();
      expect(mockUseSendFlow).toHaveBeenLastCalledWith('bitcoin');
      expect(getByTestId('send-confirm-button').props.accessibilityState?.disabled).not.toBe(true);
    });

    it('uses Spark for a Spark BTC recipient and displays its network label', async () => {
      const { getByText, getByPlaceholderText, findByText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), SPARK_RECIPIENT);
      fireEvent.changeText(getByPlaceholderText('0.00'), '1');
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });

      expect(await findByText('Bitcoin Lightning')).toBeTruthy();
      expect(mockUseSendFlow).toHaveBeenLastCalledWith('spark');
      expect(mockEstimate).toHaveBeenCalledWith(
        expect.objectContaining({ to: SPARK_RECIPIENT, amount: '1' }),
      );
    });

    it('normalizes the recipient for validation, estimate, and send', async () => {
      mockSend.mockResolvedValueOnce('btc-hash');
      const paddedRecipient = ` \n${RECIPIENT}\n `;
      const { getByText, getByPlaceholderText, getByTestId } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fireEvent.changeText(getByPlaceholderText('send.addressPlaceholder'), paddedRecipient);
      fireEvent.changeText(getByPlaceholderText('0.00'), '1');
      expect(getByTestId('send-continue-button').props.accessibilityState?.disabled).not.toBe(true);

      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });
      expect(mockEstimate).toHaveBeenCalledWith(expect.objectContaining({ to: RECIPIENT }));

      await act(async () => {
        fireEvent.press(getByText('common.confirm'));
      });
      expect(mockSend).toHaveBeenCalledWith(expect.objectContaining({ to: RECIPIENT }));
    });

    it('shows a retry action instead of Confirm when the estimate fails', async () => {
      mockEstimate.mockResolvedValueOnce({ success: false, error: 'rpc-error' });
      const { getByText, getByPlaceholderText, findByText, getAllByText, queryByText } = render(
        <SendScreen />,
      );
      // CHF has a paymaster — the fee row actually renders.
      // CHF has 2 occurrences (symbol + label) — press the first.
      fireEvent.press(getAllByText('CHF')[0]!);
      fillRecipientAndAmount(getByPlaceholderText, EVM_RECIPIENT);
      const { getByText, getByPlaceholderText, findByText } = render(<SendScreen />);
      // CHF has a paymaster — the fee row actually renders. Its row title
      // ("CHF") is the only place that literal string renders now — the
      // i18n full name (`transfer.assetName.CHF`) is a separate string.
      fireEvent.press(getByText('CHF'));
      fillRecipientAndAmount(getByPlaceholderText);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });
      expect(await findByText('send.feeUnavailable')).toBeTruthy();
      expect(queryByText('common.confirm')).toBeNull();
      expect(getByText('common.retry')).toBeTruthy();

      await act(async () => {
        fireEvent.press(getByText('common.retry'));
      });
      expect(mockEstimate).toHaveBeenCalledTimes(2);
      expect(getByText('common.confirm')).toBeTruthy();
    });

    it('renders the irreversibility warning + confirm + cancel CTAs', async () => {
      const { getByText, getByPlaceholderText, findByText, getAllByText } = render(<SendScreen />);
      // CHF has 2 occurrences (symbol + label) — press the first.
      fireEvent.press(getAllByText('CHF')[0]!);
      fillRecipientAndAmount(getByPlaceholderText, EVM_RECIPIENT);
      const { getByText, getByPlaceholderText, findByText } = render(<SendScreen />);
      fireEvent.press(getByText('CHF'));
      fillRecipientAndAmount(getByPlaceholderText);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
    it('offers to continue once the composer holds a valid address', () => {
      const screen = render(<SendScreen />);
      expect(screen.queryByTestId('send-recipient-continue')).toBeNull();
      fireEvent.changeText(screen.getByTestId('send-recipient-input'), 'not an address');
      expect(screen.queryByTestId('send-recipient-continue')).toBeNull();

      fireEvent.changeText(screen.getByTestId('send-recipient-input'), BTC_ADDR);
      expect(screen.getByText(/send\.sendToAddress/)).toBeTruthy();
      fireEvent.press(screen.getByTestId('send-recipient-continue'));
      expect(screen.getByTestId('send-amount-step')).toBeTruthy();
    });

    it('routes an IBAN to the cash-out flow instead of the amount step', () => {
      const screen = render(<SendScreen />);
      fireEvent.changeText(
        screen.getByTestId('send-recipient-input'),
        'CH93 0076 2011 6238 5295 7',
      );
      expect(screen.queryByTestId('send-recipient-continue')).toBeNull();
      expect(screen.getByText('send.payoutToBank')).toBeTruthy();
      fireEvent.press(screen.getByTestId('send-iban-payout'));
      expect(mockPush).toHaveBeenCalledWith('/(auth)/sell');
    });

    it('pastes the clipboard into the composer', async () => {
      (Clipboard.getStringAsync as jest.Mock).mockResolvedValueOnce(`  ${BTC_ADDR} `);
      const screen = render(<SendScreen />);
      await tap(screen, 'send-paste-button');
      expect(screen.getByTestId('send-recipient-input').props.value).toBe(BTC_ADDR);
    });

    it('shows the own code and copies it', async () => {
      const screen = render(<SendScreen />);
      expect(screen.getByTestId('send-code-address').props.children).toBe('bc1qaaaa…aaaaaa');
      await tap(screen, 'send-code-copy');
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith(OWN);
      expect(screen.getByText('common.copied')).toBeTruthy();
    });

    it('shares the own address', () => {
      const share = jest.spyOn(Share, 'share').mockResolvedValue({ action: Share.sharedAction });
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-code-share'));
      expect(share).toHaveBeenCalledWith({ message: OWN });
      share.mockRestore();
    });

    it('disables copy and share while the wallet has no address', () => {
      (useAccount as jest.Mock).mockReturnValue({ address: null });
      const screen = render(<SendScreen />);
      expect(screen.getAllByText('receive.walletNotInitialized')).toHaveLength(2);
      fireEvent.press(screen.getByTestId('send-code-copy'));
      expect(Clipboard.setStringAsync).not.toHaveBeenCalled();
    });

    it('links to buy crypto and opens the own-code fullscreen from QR and hint', () => {
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-code-buy'));
      expect(mockPush).toHaveBeenCalledWith('/(auth)/buy');

      fireEvent.press(screen.getByTestId('send-code-qr'));
      expect(screen.getByTestId('own-code-qr')).toBeTruthy();
      fireEvent.press(screen.getByTestId('own-code-close'));
      expect(screen.queryByTestId('own-code-qr')).toBeNull();

      fireEvent.press(screen.getByTestId('send-code-hint'));
      expect(screen.getByTestId('own-code-qr')).toBeTruthy();
      fireEvent.press(screen.getByTestId('own-code-close'));
      expect(screen.queryByTestId('own-code-qr')).toBeNull();
      expect(mockPush).not.toHaveBeenCalledWith('/(auth)/receive');
    });

    it('shows the balance of the first asset that has one in the DFX Wallet row', () => {
      setBtcBalance('2310000');
      const screen = render(<SendScreen />);
      expect(screen.getByTestId('send-account-balance').props.children).toBe('0.0231 BTC');
    });

    it('lists bank accounts with a masked IBAN and sends to cash-out on press', () => {
      mockBankAccounts.current = [{ id: 7, iban: 'CH9300762011623852957', label: 'UBS' }];
      const screen = render(<SendScreen />);
      expect(screen.getByText('UBS')).toBeTruthy();
      expect(screen.getByText('CH93 •••• 2957')).toBeTruthy();
      expect(screen.getByText('send.payout')).toBeTruthy();
      expect(screen.getByText('send.accountsLabel:{"count":2}')).toBeTruthy();
      expect(screen.queryByTestId('send-account-bank-add')).toBeNull();
      expect(
        screen
          .getAllByTestId(/^send-account-(?:bank|dfx)/)
          .map((row) => row.props.testID as string),
      ).toEqual(['send-account-bank-7', 'send-account-dfx']);
      fireEvent.press(screen.getByTestId('send-account-bank-7'));
      expect(mockPush).toHaveBeenCalledWith('/(auth)/sell');
    });

    it('opens bank-account setup from the add row and uses a proportional subtitle', () => {
      const screen = render(<SendScreen />);
      const subtitle = screen.getByText('send.accountBankAddHint');
      const subtitleStyle = StyleSheet.flatten(subtitle.props.style);
      expect(subtitleStyle.fontSize).toBe(Typography.bodyMedium.fontSize);
      expect(subtitleStyle.fontFamily).not.toBe(Typography.mono.fontFamily);
      fireEvent.press(screen.getByTestId('send-account-bank-add'));
      expect(mockPush).toHaveBeenCalledWith('/(auth)/bank-accounts/add');
    });

    it('opens the scanner from the header and closes it again', () => {
      const screen = render(<SendScreen />);
      expect(screen.queryByTestId('scanner-view')).toBeNull();
      fireEvent.press(screen.getByTestId('send-recipient-scan-button'));
      expect(screen.getByTestId('scanner-view')).toBeTruthy();
      act(() => {
        mockScannerProps.onClose!();
      });
      expect(screen.queryByTestId('scanner-view')).toBeNull();
    });

    it('closes the scanner before opening settings', () => {
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-recipient-scan-button'));
      act(() => {
        mockScannerProps.onOpenSettings!();
      });
      expect(screen.queryByTestId('scanner-view')).toBeNull();
      expect(mockPush).toHaveBeenCalledWith('/settings');
    });

    it('goes straight to the amount step for a scanned address', () => {
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-recipient-scan-button'));
      act(() => {
        mockScannerProps.onScan!(BTC_ADDR);
      });
      expect(screen.getByTestId('send-amount-step')).toBeTruthy();
      expect(screen.getByTestId('send-recipient-meta').props.children).toBe('bc1qar0s…wf5mdq');
      expect(screen.queryByTestId('scanner-view')).toBeNull();
    });

    it('keeps the scanner open when the scanned code is unknown', () => {
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-recipient-scan-button'));
      let handled = true;
      act(() => {
        handled = mockScannerProps.onScan!('not a payment code');
      });
      expect(handled).toBe(false);
      expect(screen.getByTestId('scanner-view')).toBeTruthy();
    });

    it('prefills a scanned Bitcoin amount', () => {
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-recipient-scan-button'));
      act(() => {
        mockScannerProps.onScan!(`bitcoin:${BTC_ADDR}?amount=0.001`);
      });
      expect(screen.getByTestId('send-amount-value').props.children).toBe('0.001');
    });

    it('returns to the overview with a scanned IBAN', () => {
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-recipient-scan-button'));
      act(() => {
        mockScannerProps.onScan!('CH93 0076 2011 6238 5295 7');
      });
      expect(screen.getByTestId('send-iban-payout')).toBeTruthy();
      expect(screen.queryByTestId('scanner-view')).toBeNull();
    });

    it('closes the scanner and pushes OpenCryptoPay for an LNURL', () => {
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-recipient-scan-button'));
      act(() => {
        mockScannerProps.onScan!('lnurl1abc');
      });
      expect(mockPush).toHaveBeenCalledWith({
        pathname: '/(auth)/pay/opencryptopay',
        params: { lnurl: 'lnurl1abc' },
      });
      expect(screen.queryByTestId('scanner-view')).toBeNull();
    });

    it('applies address route params once after address-book hydration', () => {
      mockSearchParams.current = { address: BTC_ADDR, amount: '0.001' };
      const screen = render(<SendScreen />);
      expect(screen.getByTestId('send-amount-step')).toBeTruthy();
      expect(screen.getByTestId('send-amount-value').props.children).toBe('0.001');
      expect(mockReset).toHaveBeenCalledTimes(1);

      screen.rerender(<SendScreen />);
      expect(mockReset).toHaveBeenCalledTimes(1);
    });

    it('applies a query route param once', () => {
      mockSearchParams.current = { query: 'CH9300762011623852957' };
      const screen = render(<SendScreen />);
      expect(screen.getByTestId('send-iban-payout')).toBeTruthy();

      fireEvent.changeText(screen.getByTestId('send-recipient-input'), 'changed');
      screen.rerender(<SendScreen />);
      expect(screen.getByTestId('send-recipient-input').props.value).toBe('changed');
    });

    it('blocks removal, cancel, back, and a second transfer while send is in flight', async () => {
      let resolveSend: ((hash: string | null) => void) | undefined;
      mockSend.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSend = resolve;
          }),
      );
      const { getByLabelText, getByPlaceholderText, getByTestId, getByText } = render(
        <SendScreen />,
      );
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });

      fireEvent.press(getByTestId('send-confirm-button'));

      const cancelButton = getByTestId('send-cancel-button');
      const backButton = getByLabelText('common.back');
      expect(mockUsePreventRemove).toHaveBeenLastCalledWith(true, expect.any(Function));
      expect(cancelButton.props.accessibilityState?.disabled).toBe(true);
      expect(backButton.props.accessibilityState?.disabled).toBe(true);
      expect(mockStackScreenOptions.current?.gestureEnabled).toBe(false);

      fireEvent.press(cancelButton);
      fireEvent.press(backButton);
      fireEvent.press(getByTestId('send-confirm-button'));
      expect(mockSend).toHaveBeenCalledTimes(1);
      expect(mockSend).toHaveBeenCalledWith({
        asset: expect.anything(),
        to: RECIPIENT,
        amount: '1',
      });

      await act(async () => {
        resolveSend?.(null);
        await Promise.resolve();
      });

      expect(mockUsePreventRemove).toHaveBeenLastCalledWith(false, expect.any(Function));
    });

    it('ignores a late successful send result after unmount', async () => {
      let resolveSend: ((hash: string | null) => void) | undefined;
      mockSend.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveSend = resolve;
          }),
      );
      const { getByPlaceholderText, getByTestId, getByText, unmount } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      await act(async () => {
        fireEvent.press(getByText('common.continue'));
      });
      fireEvent.press(getByTestId('send-confirm-button'));

      // User actions cannot supersede an in-flight send because cancel, back,
      // and the navigation gesture are disabled; unmount is the reachable case.
      unmount();

      await act(async () => {
        resolveSend?.('late-hash');
        await Promise.resolve();
      });
      expect(Haptics.notificationAsync).not.toHaveBeenCalled();
    });
  });

  describe('contacts', () => {
    it('creates a contact from the "new" entry', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-contact-new'));
      fireEvent.changeText(screen.getByTestId('send-contact-name-input'), 'Sven');
      fireEvent.changeText(screen.getByTestId('send-contact-address-input'), EVM_ADDR_2);
      fireEvent.press(screen.getByTestId('send-contact-save-button'));

      const saved = useAddressBookStore.getState().contacts.find((c) => c.name === 'Sven');
      expect(saved).toMatchObject({ address: EVM_ADDR_2, chain: 'ethereum' });
      expect(screen.queryByTestId('send-contact-name-input')).toBeNull();
      expect(screen.getByText('Sven')).toBeTruthy();
    });

    it('stores a Bitcoin contact on Spark with BTC as its asset', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-contact-new'));
      fireEvent.changeText(screen.getByTestId('send-contact-name-input'), 'Nora');
      fireEvent.changeText(screen.getByTestId('send-contact-address-input'), OWN);
      fireEvent.press(screen.getByTestId('send-contact-save-button'));
      const saved = useAddressBookStore.getState().contacts.find((c) => c.name === 'Nora');
      expect(saved).toMatchObject({ chain: 'spark', assetSymbol: 'BTC' });
    });

    it('keeps the sheet open and names the problem for a bad name or address', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-contact-new'));

      fireEvent.changeText(screen.getByTestId('send-contact-address-input'), EVM_ADDR_2);
      fireEvent.press(screen.getByTestId('send-contact-save-button'));
      expect(screen.getByTestId('send-contact-error').props.children).toBe(
        'send.contactInvalidName',
      );

      fireEvent.changeText(screen.getByTestId('send-contact-name-input'), 'Sven');
      fireEvent.changeText(screen.getByTestId('send-contact-address-input'), 'nope');
      fireEvent.press(screen.getByTestId('send-contact-save-button'));
      expect(screen.getByTestId('send-contact-error').props.children).toBe(
        'send.contactInvalidAddress',
      );
      expect(useAddressBookStore.getState().contacts).toEqual([ANNA]);
    });

    it('renames a contact from the long-press menu', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      fireEvent(screen.getByTestId('send-contact-c-anna'), 'longPress');
      fireEvent.press(screen.getByTestId('send-contact-action-rename'));
      expect(screen.queryByTestId('send-contact-address-input')).toBeNull();
      expect(screen.getByTestId('send-contact-name-input').props.value).toBe('Anna');
      fireEvent.changeText(screen.getByTestId('send-contact-name-input'), 'Anna M.');
      fireEvent.press(screen.getByTestId('send-contact-save-button'));
      expect(useAddressBookStore.getState().contacts[0]?.name).toBe('Anna M.');
      expect(screen.getByText('Anna M.')).toBeTruthy();
    });

    it('deletes a contact from the long-press menu', () => {
      seedContacts(ANNA, MARCO);
      const screen = render(<SendScreen />);
      fireEvent(screen.getByTestId('send-contact-c-anna'), 'longPress');
      fireEvent.press(screen.getByTestId('send-contact-action-delete'));
      expect(useAddressBookStore.getState().contacts.map((c) => c.id)).toEqual(['c-marco']);
      expect(screen.queryByTestId('send-contact-c-anna')).toBeNull();
    });

    it('closes the long-press menu through its backdrop', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      fireEvent(screen.getByTestId('send-contact-c-anna'), 'longPress');
      fireEvent.press(screen.getByTestId('send-contact-actions-backdrop'));
      expect(screen.queryByTestId('send-contact-action-rename')).toBeNull();
      expect(useAddressBookStore.getState().contacts).toEqual([ANNA]);
    });
  });

  describe('amount step: units', () => {
    it('opens for a contact with name, address and when it was last used', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-contact-c-anna'));
      expect(screen.getByTestId('send-amount-step')).toBeTruthy();
      expect(screen.getByText('Anna')).toBeTruthy();
      expect(screen.getByTestId('send-recipient-meta').props.children).toBe(
        'bc1qar0s…wf5mdq · send.lastUsed.days:{"count":2}',
      );
    });

      fireEvent.press(getByLabelText('common.back'));
      expect(queryByText('send.confirmTransaction')).toBeNull();
      expect(getByText('common.continue')).toBeTruthy();
    it('shows "new address" for an address without a contact', () => {
      const screen = render(<SendScreen />);
      fireEvent.changeText(screen.getByTestId('send-recipient-input'), EVM_ADDR);
      fireEvent.press(screen.getByTestId('send-recipient-continue'));
      expect(screen.getByText('send.newAddress')).toBeTruthy();
    });

    it.each([
      ['BTC', ANNA, ['BTC', 'CHF', 'EUR']],
      ['CHF', MARCO, ['CHF', 'EUR']],
      ['EUR', LEA, ['EUR', 'CHF']],
      ['USD', TIM, ['USD', 'CHF', 'EUR']],
    ] as const)(
      'orders the units asset first, then CHF, then EUR: %s',
      (_symbol, contact, units) => {
        seedContacts(ANNA, MARCO, LEA, TIM);
        const screen = render(<SendScreen />);
        fireEvent.press(screen.getByTestId(`send-contact-${contact.id}`));
        expect(unitIds(screen)).toEqual(units.map((u) => `send-unit-${u}`));
      },
    );

      fireEvent.press(getByLabelText('common.back'));
      expect(getByText('send.sendToCrypto')).toBeTruthy();
    it('starts on the asset unit and marks it selected', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-contact-c-anna'));
      expect(screen.getByTestId('send-unit-BTC').props.accessibilityState.selected).toBe(true);
      expect(screen.getByTestId('send-unit-CHF').props.accessibilityState.selected).toBe(false);
    });

    it('hides a fiat unit that has no rate instead of pricing it at 0', () => {
      mockRates.delete('btc:EUR');
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-contact-c-anna'));
      expect(unitIds(screen)).toEqual(['send-unit-BTC', 'send-unit-CHF']);
    });

    it('clears the typed amount when the unit changes', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      openAmount(screen, ANNA, '5');
      expect(screen.getByTestId('send-amount-value').props.children).toBe('5');
      fireEvent.press(screen.getByTestId('send-unit-CHF'));
      expect(screen.getByTestId('send-amount-value').props.children).toBe('0');
    });

    it('lets a contact only use the assets that fit its address', () => {
      seedContacts(MARCO);
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-contact-c-marco'));
      fireEvent.press(screen.getByTestId('send-unit-CHF'));
      expect(screen.getByTestId('send-asset-eur')).toBeTruthy();
      expect(screen.getByTestId('send-asset-usd')).toBeTruthy();
      expect(screen.queryByTestId('send-asset-btc')).toBeNull();
    });

    it('switches the asset through the picker sheet opened by a second tap on the asset unit', () => {
      seedContacts(MARCO);
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-contact-c-marco'));
      expect(screen.queryByTestId('send-asset-list')).toBeNull();
      fireEvent.press(screen.getByTestId('send-unit-CHF'));
      fireEvent.press(screen.getByTestId('send-asset-eur'));
      expect(unitIds(screen)).toEqual(['send-unit-EUR', 'send-unit-CHF']);
      expect(screen.queryByTestId('send-asset-list')).toBeNull();
    });

    it('does not open a picker when the address only fits one asset', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-contact-c-anna'));
      fireEvent.press(screen.getByTestId('send-unit-BTC'));
      expect(screen.queryByTestId('send-asset-list')).toBeNull();
    });

    it('goes back to the asset unit with a first tap while a fiat unit is active', () => {
      seedContacts(MARCO);
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-contact-c-marco'));
      fireEvent.press(screen.getByTestId('send-unit-EUR'));
      fireEvent.press(screen.getByTestId('send-unit-CHF'));
      expect(screen.queryByTestId('send-asset-list')).toBeNull();
      expect(screen.getByTestId('send-unit-CHF').props.accessibilityState.selected).toBe(true);
    });

    it('shows the chain bar for stablecoins with the contact chain preselected', () => {
      seedContacts(MARCO);
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-contact-c-marco'));
      expect(screen.getByTestId('send-chain-bar')).toBeTruthy();
      expect(screen.getByTestId('send-chain-polygon').props.accessibilityState.selected).toBe(true);
      fireEvent.press(screen.getByTestId('send-chain-base'));
      expect(screen.getByTestId('send-chain-base').props.accessibilityState.selected).toBe(true);
      expect(screen.getByTestId('send-chain-polygon').props.accessibilityState.selected).toBe(
        false,
      );
    });

    it('has no chain bar for BTC', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-contact-c-anna'));
      expect(screen.queryByTestId('send-chain-bar')).toBeNull();
    });
  });

  describe('QR scanner integration', () => {
    it('a scanned bitcoin URI populates the bare address on the BTC screen', () => {
      const { getByText, getByPlaceholderText } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      // Drive the scanner's `onScan` directly — the screen exposes it via
      // the QrScanner mock. The handler should strip the prefix/query and
      // pipe the bare address into the recipient state. RECIPIENT is the public
      // BIP173 example; its declaration carries the no-secrets disable.
      expect(qrScannerProps.onScan).not.toBeNull();
      act(() => {
        qrScannerProps.onScan!(`bitcoin:${RECIPIENT}?amount=1`);
      });
      expect(
        (getByPlaceholderText('send.addressPlaceholder') as unknown as { props: { value: string } })
          .props.value,
      ).toBe(RECIPIENT);
    });

    it('a scanned ethereum URI populates the bare address on an EVM asset', () => {
      const { getAllByText, getByPlaceholderText } = render(<SendScreen />);
      fireEvent.press(getAllByText('CHF')[0]!);
      expect(qrScannerProps.onScan).not.toBeNull();
      act(() => {
        qrScannerProps.onScan!(`ethereum:${EVM_RECIPIENT}?amount=1`);
      });
      expect(
        (getByPlaceholderText('send.addressPlaceholder') as unknown as { props: { value: string } })
          .props.value,
      ).toBe(EVM_RECIPIENT);
  describe('amount step: input and send button', () => {
    it('types a fiat amount, shows the asset equivalent and names the recipient on the button', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      openAmount(screen, ANNA, '180', 'CHF');
      expect(screen.getByTestId('send-amount-value').props.children).toBe('180');
      expect(screen.getByTestId('send-equivalents').props.children).toBe('≈ 0.00295081 BTC');
      expect(screen.getByText('send.ctaSend:{"amount":"CHF 180","name":"Anna"}')).toBeTruthy();
    });

    it('shows the fiat equivalents while typing in the asset unit', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      openAmount(screen, ANNA, '0.004');
      expect(screen.getByTestId('send-equivalents').props.children).toBe(
        '≈ CHF 244.00 · EUR 228.00',
      );
    });

    it('limits the fraction to two digits for fiat and to the asset decimals otherwise', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      openAmount(screen, ANNA, '1.239', 'CHF');
      expect(screen.getByTestId('send-amount-value').props.children).toBe('1.23');
      fireEvent.press(screen.getByTestId('send-unit-BTC'));
      typeAmount(screen, '0.123456789');
      expect(screen.getByTestId('send-amount-value').props.children).toBe('0.12345678');
    });

    it('deletes digit by digit', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      openAmount(screen, ANNA, '42');
      fireEvent.press(screen.getByTestId('amount-key-delete'));
      expect(screen.getByTestId('send-amount-value').props.children).toBe('4');
      fireEvent.press(screen.getByTestId('amount-key-delete'));
      expect(screen.getByTestId('send-amount-value').props.children).toBe('0');
    });

    it('back from asset step calls router.back()', () => {
      const { getByLabelText } = render(<SendScreen />);
      fireEvent.press(getByLabelText('common.back'));
      expect(mockBack).toHaveBeenCalledTimes(1);
    it('disables the button at 0 and does not estimate', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      openAmount(screen, ANNA);
      expect(screen.getByText('send.enterAmount')).toBeTruthy();
      fireEvent.press(screen.getByTestId('send-continue-button'));
      expect(mockEstimate).not.toHaveBeenCalled();
      expect(screen.getByTestId('send-amount-step')).toBeTruthy();
    });

    it('disables the button when the amount exceeds the balance', () => {
      setBtcBalance('100000');
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      openAmount(screen, ANNA, '1');
      expect(screen.getByText('send.insufficientBalance')).toBeTruthy();
      fireEvent.press(screen.getByTestId('send-continue-button'));
      expect(mockEstimate).not.toHaveBeenCalled();
    });

    it('allows an amount within the balance', () => {
      setBtcBalance('100000');
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      openAmount(screen, ANNA, '0.0005');
      expect(screen.queryByText('send.insufficientBalance')).toBeNull();
      expect(screen.getByText(/send\.ctaSend/)).toBeTruthy();
    });

    it('does not block on a balance that is still unknown', () => {
      const id = getSendAssetForCanonical('BTC', 'spark')!.getId();
      mockBalances.set(id, { assetId: id, rawBalance: '0', status: 'loading' });
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      openAmount(screen, ANNA, '1');
      expect(screen.queryByText('send.insufficientBalance')).toBeNull();
      expect(screen.getByText(/send\.ctaSend/)).toBeTruthy();
    });

    it('disables the button when the price of the active fiat unit disappears', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      openAmount(screen, ANNA, '1', 'CHF');
      mockRates.delete('btc:CHF');
      fireEvent.press(screen.getByTestId('amount-key-0'));
      expect(screen.getByText('send.rateUnavailable')).toBeTruthy();
    });

    it('shows the in-flow error message on the amount step', () => {
      flowState.error = 'insufficient funds';
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-contact-c-anna'));
      expect(screen.getByTestId('send-input-error').props.children).toBe('insufficient funds');
    });

    it('goes back to the overview and keeps the composer text', () => {
      const screen = render(<SendScreen />);
      fireEvent.changeText(screen.getByTestId('send-recipient-input'), BTC_ADDR);
      fireEvent.press(screen.getByTestId('send-recipient-continue'));
      fireEvent.press(screen.getByLabelText('Back'));
      expect(screen.getByTestId('send-overview-step')).toBeTruthy();
      expect(screen.getByTestId('send-recipient-input').props.value).toBe(BTC_ADDR);
      expect(mockBack).not.toHaveBeenCalled();
    });
  });

  describe('theme colors', () => {
    it('uses the on-primary token for the sell shortcut icon in dark mode', () => {
      useThemeStore.setState({ mode: 'dark' });
      const { getByTestId, getByText } = render(
        <ThemeProvider>
          <SendScreen />
        </ThemeProvider>,
      );
      fireEvent.press(getByText('BTC'));

      const [swapIcon] = within(getByTestId('send-action-sell')).UNSAFE_getAllByType(Svg);
      const swapPaths = within(swapIcon!).UNSAFE_getAllByType(Path);
      expect(swapPaths.length).toBeGreaterThan(0);
      for (const swapPath of swapPaths) {
        expect(swapPath.props.stroke).toBe(darkColors.onPrimary);
        expect(swapPath.props.stroke).not.toBe(darkColors.white);
      }
    });
  });

  describe('fee state intermediate display', () => {
    it('shows the "estimating" copy while the estimate is in flight (loading branch)', async () => {
      // Make the estimate hang so we can observe the in-flight render.
      let releaseEstimate: ((value: { success: boolean; fee: string }) => void) | undefined;
  describe('amount step: fee preview', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('shows a placeholder until an amount is typed', () => {
      seedContacts(MARCO);
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-contact-c-marco'));
      expect(screen.getByTestId('send-fee-line').props.children).toBe('send.feeLineIdle');
    });

    it('estimates after a short pause and shows the fee in the paymaster token', async () => {
      seedContacts(MARCO);
      const screen = render(<SendScreen />);
      openAmount(screen, MARCO, '5');
      expect(screen.getByTestId('send-fee-line').props.children).toBe('send.feeEstimating');
      expect(mockEstimate).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      expect(mockEstimate).toHaveBeenCalledWith(
        expect.objectContaining({ to: EVM_ADDR, amount: '5' }),
      );
      expect(screen.getByTestId('send-fee-line').props.children).toBe(
        'send.feeLine:{"fee":"0.021 USDT"}',
      );
    });

    it('estimates once for a burst of keystrokes', async () => {
      seedContacts(MARCO);
      const screen = render(<SendScreen />);
      openAmount(screen, MARCO, '1');
      await act(async () => {
        jest.advanceTimersByTime(200);
      });
      typeAmount(screen, '2');
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      expect(mockEstimate).toHaveBeenCalledTimes(1);
      expect(mockEstimate).toHaveBeenCalledWith(expect.objectContaining({ amount: '12' }));
    });

    it('says so when the estimate fails', async () => {
      mockEstimate.mockResolvedValue({ success: false, error: 'rpc-error' });
      seedContacts(MARCO);
      const screen = render(<SendScreen />);
      openAmount(screen, MARCO, '5');
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      expect(screen.getByTestId('send-fee-line').props.children).toBe('send.feeUnavailable');
    });

    it('drops a stale estimate that arrives after the amount changed', async () => {
      let resolveFirst: ((value: { success: boolean; fee: string }) => void) | undefined;
      mockEstimate.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      );
      const { getByText, getByPlaceholderText, getByTestId } = render(<SendScreen />);
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      fireEvent.press(getByText('common.continue'));
      // Confirm step now mounts and the fee row shows the loading label.
      mockEstimate.mockResolvedValueOnce({ success: true, fee: '42000' });
      seedContacts(MARCO);
      const screen = render(<SendScreen />);
      openAmount(screen, MARCO, '1');
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      typeAmount(screen, '2');
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      await act(async () => {
        resolveFirst?.({ success: true, fee: '99000000' });
      });
      expect(getByText('send.feeEstimating')).toBeTruthy();
      expect(getByTestId('send-confirm-button').props.accessibilityState?.disabled).toBe(true);
      // Release so the promise queue drains before the test ends.
      releaseEstimate?.({ success: true, fee: '21000000000000' });
      expect(screen.getByTestId('send-fee-line').props.children).toBe(
        'send.feeLine:{"fee":"0.042 USDT"}',
      );
    });

    it('shows the placeholder for a chain without a fee token', async () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      openAmount(screen, ANNA, '1');
      await act(async () => {
        jest.advanceTimersByTime(400);
      });
      expect(mockEstimate).toHaveBeenCalled();
      expect(screen.getByTestId('send-fee-line').props.children).toBe('send.feeLineIdle');
    });
  });

  describe('confirm step', () => {
    it('sends the typed fiat amount converted and rounded DOWN to the asset decimals', async () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      await openConfirm(screen, ANNA, '180', 'CHF');
      expect(screen.getByTestId('send-confirm-step')).toBeTruthy();
      expect(mockEstimate).toHaveBeenCalledWith(
        expect.objectContaining({ to: BTC_ADDR, amount: '0.00295081' }),
      );

      mockSend.mockResolvedValueOnce('0xhash');
      await tap(screen, 'send-confirm-button');
      expect(mockSend).toHaveBeenCalledWith(
        expect.objectContaining({ to: BTC_ADDR, amount: '0.00295081' }),
      );
    });

    it('sends an asset amount unchanged', async () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      await openConfirm(screen, ANNA, '0.5');
      expect(mockEstimate).toHaveBeenCalledWith(expect.objectContaining({ amount: '0.5' }));
    });

    it('lists recipient, network, amount, the typed fiat value and the fee', async () => {
      seedContacts(MARCO);
      const screen = render(<SendScreen />);
      await openConfirm(screen, MARCO, '5', 'EUR');
      expect(screen.getByText('send.confirmTransaction')).toBeTruthy();
      expect(screen.getByTestId('send-confirm-recipient').props.children).toBe('Marco');
      expect(screen.getByTestId('send-confirm-address').props.children).toBe('0xab12ab12…12ab12');
      expect(screen.getByTestId('send-confirm-network').props.children).toBe('Polygon');
      expect(screen.getByTestId('send-confirm-entered').props.children).toBe('EUR 5.00');
      // 5 EUR / 1.05 EUR per CHF-stablecoin, rounded down to 18 decimals.
      expect(screen.getByTestId('send-confirm-amount').props.children).toBe(
        '4.761904761904761904 CHF',
      );
      expect(screen.getByTestId('send-confirm-fee').props.children).toBe('0.021 USDT');
      expect(screen.getByText('send.irreversible')).toBeTruthy();
      expect(screen.getByText('common.confirm')).toBeTruthy();
      expect(screen.getByText('common.cancel')).toBeTruthy();
    });

    it('does not repeat the entered amount when it is already in the asset unit', async () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      await openConfirm(screen, ANNA, '1');
      expect(screen.queryByTestId('send-confirm-entered')).toBeNull();
      expect(screen.getByTestId('send-confirm-amount').props.children).toBe('1 BTC');
      expect(screen.getByTestId('send-confirm-fee').props.children).toBe('–');
    });

    it('shows the "fee unavailable" copy when the estimate fails', async () => {
      mockEstimate.mockResolvedValue({ success: false, error: 'rpc-error' });
      seedContacts(MARCO);
      const screen = render(<SendScreen />);
      await openConfirm(screen, MARCO, '5');
      expect(screen.getByTestId('send-confirm-fee').props.children).toBe('send.feeUnavailable');
    });

    it('cancel returns to the amount step, keeps the input and resets the flow', async () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      await openConfirm(screen, ANNA, '1');
      fireEvent.press(screen.getByTestId('send-cancel-button'));
      expect(mockReset).toHaveBeenCalled();
      expect(screen.queryByTestId('send-confirm-step')).toBeNull();
      expect(screen.getByTestId('send-amount-value').props.children).toBe('1');
    });

    it('back from confirm returns to the amount step', async () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      await openConfirm(screen, ANNA, '1');
      fireEvent.press(screen.getByLabelText('Back'));
      expect(screen.getByTestId('send-amount-step')).toBeTruthy();
      expect(mockBack).not.toHaveBeenCalled();
    });

    it('shows the estimating copy while the estimate is in flight', async () => {
      mockEstimate.mockImplementationOnce(() => new Promise(() => undefined));
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      await openConfirm(screen, ANNA, '1');
      expect(screen.getByTestId('send-confirm-fee').props.children).toBe('send.feeEstimating');
    });

    it('drops the stale fee result when a second estimate races the first', async () => {
      // First estimate hangs; navigating back and continuing starts a second
      // overlapping estimate. The second resolves first and must remain visible
      // after the older request eventually resolves.
      // First estimate hangs; cancel + retry bumps the request counter. The
      // first promise finally resolves — its result must be discarded.
      let resolveFirst: ((value: { success: boolean; fee: string }) => void) | undefined;
      mockEstimate.mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      );
      mockEstimate.mockResolvedValueOnce({ success: true, fee: '2222' });

      const { getByText, getByPlaceholderText, getByLabelText, queryByText } = render(
        <SendScreen />,
      );
      fireEvent.press(getByText('BTC'));
      fillRecipientAndAmount(getByPlaceholderText);
      fireEvent.press(getByText('common.continue'));
      await act(async () => {
        await Promise.resolve();
      });
      fireEvent.press(getByLabelText('common.back'));
      fireEvent.press(getByText('common.continue'));
      await act(async () => {
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(getByText('0.00002222 BTC')).toBeTruthy();
      // Late resolve of the stale first estimate — the `reqId !==
      // estimateReqRef.current` guard discards it without touching state.
      await act(async () => {
        resolveFirst?.({ success: true, fee: '1111' });
        await Promise.resolve();
      });
      expect(getByText('0.00002222 BTC')).toBeTruthy();
      expect(queryByText('0.00001111 BTC')).toBeNull();
      mockEstimate.mockResolvedValue({ success: true, fee: '21000' });
      seedContacts(MARCO);
      const screen = render(<SendScreen />);
      await openConfirm(screen, MARCO, '5');
      fireEvent.press(screen.getByTestId('send-cancel-button'));
      await tap(screen, 'send-continue-button');
      await act(async () => {
        resolveFirst?.({ success: false, fee: 'STALE-VALUE' });
      });
      expect(screen.getByTestId('send-confirm-fee').props.children).toBe('0.021 USDT');
    });

    it('shows the in-flow error message on the confirm step too', async () => {
      flowState.error = 'gas estimation failed';
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      await openConfirm(screen, ANNA, '1');
      expect(screen.getByText('gas estimation failed')).toBeTruthy();
    });

    it('stays on the confirm step when the send fails', async () => {
      mockSend.mockResolvedValueOnce(null);
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      await openConfirm(screen, ANNA, '1');
      await tap(screen, 'send-confirm-button');
      expect(screen.queryByTestId('send-success-step')).toBeNull();
      expect(screen.getByTestId('send-confirm-step')).toBeTruthy();
    });
  });

  describe('sent step', () => {
    const sendTo = async (screen: Screen, contact: Contact, digits: string, hash: string) => {
      mockSend.mockResolvedValueOnce(hash);
      flowState.txHash = hash;
      await openConfirm(screen, contact, digits);
      await tap(screen, 'send-confirm-button');
    };

    it('shows where the money is going and the typed amount as the headline', async () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      await sendTo(screen, ANNA, '1', '0xdeadbeef');
      expect(screen.getByTestId('send-success-step')).toBeTruthy();
      expect(screen.getByText('send.onTheWayTo:{"name":"Anna"}')).toBeTruthy();
      expect(screen.getByText('BTC 1')).toBeTruthy();
    });

    it('marks the contact as used', async () => {
      seedContacts(ANNA);
      const before = ANNA.lastUsedAt!;
      const screen = render(<SendScreen />);
      await sendTo(screen, ANNA, '1', '0xdeadbeef');
      const used = useAddressBookStore.getState().contacts.find((c) => c.id === 'c-anna');
      expect(used?.lastUsedAt).toBeGreaterThan(before);
    });

    it('has no back button and finishes with "done"', async () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      await sendTo(screen, ANNA, '1', '0xdeadbeef');
      expect(screen.queryByLabelText('Back')).toBeNull();
      fireEvent.press(screen.getByTestId('send-done-button'));
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it('links to the block explorer when the chain has one', async () => {
      const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
      seedContacts(MARCO);
      const screen = render(<SendScreen />);
      await sendTo(screen, MARCO, '5', '0xabc');
      fireEvent.press(screen.getByTestId('send-view-tx'));
      expect(open).toHaveBeenCalledWith('https://polygonscan.com/tx/0xabc');
      open.mockRestore();
    });

    it('offers to copy the hash when the chain has no explorer', async () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      await sendTo(screen, ANNA, '1', '0xdeadbeef');
      expect(screen.queryByTestId('send-view-tx')).toBeNull();
      await tap(screen, 'send-copy-tx');
      expect(Clipboard.setStringAsync).toHaveBeenCalledWith('0xdeadbeef');
    });

    it('shows what a typed fiat amount bought', async () => {
      mockSend.mockResolvedValueOnce('0xdeadbeef');
      flowState.txHash = '0xdeadbeef';
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      await openConfirm(screen, ANNA, '180', 'CHF');
      await tap(screen, 'send-confirm-button');
      expect(screen.getByText('CHF 180')).toBeTruthy();
      expect(screen.getByText('≈ 0.00295081 BTC')).toBeTruthy();
    });

    it('offers no "save address" for a contact', async () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      await sendTo(screen, ANNA, '1', '0xdeadbeef');
      expect(screen.queryByTestId('send-save-address')).toBeNull();
    });

    it('saves an unknown address as a contact after sending', async () => {
      const screen = render(<SendScreen />);
      fireEvent.changeText(screen.getByTestId('send-recipient-input'), BTC_ADDR);
      fireEvent.press(screen.getByTestId('send-recipient-continue'));
      typeAmount(screen, '1');
      mockSend.mockResolvedValueOnce('0xdeadbeef');
      flowState.txHash = '0xdeadbeef';
      await tap(screen, 'send-continue-button');
      await tap(screen, 'send-confirm-button');

      expect(screen.getByText('send.onTheWayTo:{"name":"bc1qar…5mdq"}')).toBeTruthy();
      fireEvent.press(screen.getByTestId('send-save-address'));
      expect(screen.queryByTestId('send-contact-address-input')).toBeNull();
      fireEvent.changeText(screen.getByTestId('send-contact-name-input'), 'Tina');
      fireEvent.press(screen.getByTestId('send-contact-save-button'));

      const saved = useAddressBookStore.getState().contacts[0];
      expect(saved).toMatchObject({
        name: 'Tina',
        address: BTC_ADDR,
        chain: 'spark',
        assetSymbol: 'BTC',
      });
      expect(saved?.lastUsedAt).toBeDefined();
      expect(screen.queryByTestId('send-save-address')).toBeNull();
    });
  });

  describe('back navigation', () => {
    it('back from the overview leaves the screen', () => {
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByLabelText('Back'));
      expect(mockBack).toHaveBeenCalledTimes(1);
    });

    it('resets the flow when going back from the amount step', () => {
      seedContacts(ANNA);
      const screen = render(<SendScreen />);
      fireEvent.press(screen.getByTestId('send-contact-c-anna'));
      mockReset.mockClear();
      fireEvent.press(screen.getByLabelText('Back'));
      expect(mockReset).toHaveBeenCalled();
    });
  });
});
