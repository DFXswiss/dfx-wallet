import { fireEvent, render } from '@testing-library/react-native';

const mockReplace = jest.fn();
const mockPush = jest.fn();
const mockBack = jest.fn();

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ back: mockBack, push: mockPush, replace: mockReplace }),
}));

jest.mock('@/features/scan/ScannerView', () => {
  const React = jest.requireActual('react');
  const { Pressable, View } = jest.requireActual('react-native');

  function ScannerView({ onScan }: { onScan: (data: string) => boolean }) {
    const [unknown, setUnknown] = React.useState(false);
    const run = (data: string) => setUnknown(!onScan(data));
    return (
      <View testID="scanner-view">
        <Pressable
          testID="scan-address"
          onPress={() => run('bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq')}
        />
        <Pressable
          testID="scan-address-amount"
          onPress={() =>
            run('bitcoin:bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq?amount=0.001')
          }
        />
        <Pressable testID="scan-iban" onPress={() => run('CH93 0076 2011 6238 5295 7')} />
        <Pressable testID="scan-ocp" onPress={() => run('lnurl1abc')} />
        <Pressable testID="scan-unknown" onPress={() => run('some-payload')} />
        {unknown && <View testID="scanner-unknown" />}
      </View>
    );
  }

  return { ScannerView };
});

// eslint-disable-next-line import/first
import PayScreen from '../../src/features/pay/PayScreenImpl';

describe('PayScreen', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockPush.mockReset();
    mockBack.mockReset();
  });

  it('replaces Pay with Send for an address', () => {
    const screen = render(<PayScreen />);
    fireEvent.press(screen.getByTestId('scan-address'));
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(auth)/send',
      params: { address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq' },
    });
  });

  it('passes a BIP-21 amount to Send', () => {
    const screen = render(<PayScreen />);
    fireEvent.press(screen.getByTestId('scan-address-amount'));
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(auth)/send',
      params: {
        address: 'bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq',
        amount: '0.001',
      },
    });
  });

  it('replaces Pay with Send and an IBAN query', () => {
    const screen = render(<PayScreen />);
    fireEvent.press(screen.getByTestId('scan-iban'));
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(auth)/send',
      params: { query: 'CH9300762011623852957' },
    });
  });

  it('replaces Pay with OpenCryptoPay for an LNURL', () => {
    const screen = render(<PayScreen />);
    fireEvent.press(screen.getByTestId('scan-ocp'));
    expect(mockReplace).toHaveBeenCalledWith({
      pathname: '/(auth)/pay/opencryptopay',
      params: { lnurl: 'lnurl1abc' },
    });
  });

  it('leaves unknown data in the scanner sheet', () => {
    const screen = render(<PayScreen />);
    fireEvent.press(screen.getByTestId('scan-unknown'));
    expect(screen.getByTestId('scanner-unknown')).toBeTruthy();
    expect(mockReplace).not.toHaveBeenCalled();
  });
});
