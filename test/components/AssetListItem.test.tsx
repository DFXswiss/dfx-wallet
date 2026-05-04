import { render, fireEvent } from '@testing-library/react-native';
import { AssetListItem } from '../../src/components/AssetListItem';

const baseProps = {
  symbol: 'ETH',
  name: 'Ether',
  chain: 'ethereum',
  balance: '1.25',
  balanceFiat: 'CHF 4 200.00',
};

describe('AssetListItem', () => {
  it('renders name, balance and fiat label', () => {
    const { getByText } = render(<AssetListItem {...baseProps} />);
    expect(getByText('Ether')).toBeTruthy();
    expect(getByText('1.25 ETH')).toBeTruthy();
    expect(getByText('CHF 4 200.00')).toBeTruthy();
  });

  it('translates known chain ids to their human label', () => {
    const { getByText } = render(<AssetListItem {...baseProps} chain="ethereum" />);
    expect(getByText('Ethereum')).toBeTruthy();
  });

  it('falls back to the raw chain id when unknown', () => {
    const { getByText } = render(<AssetListItem {...baseProps} chain="solana" />);
    expect(getByText('solana')).toBeTruthy();
  });

  it('uses the first two letters of the symbol as the icon text', () => {
    const { getByText } = render(<AssetListItem {...baseProps} symbol="USDT" />);
    expect(getByText('US')).toBeTruthy();
  });

  it('calls onPress when tapped if a handler is provided', () => {
    const onPress = jest.fn();
    const { getByText } = render(<AssetListItem {...baseProps} onPress={onPress} />);
    fireEvent.press(getByText('Ether'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled (no press fired) when onPress is omitted', () => {
    // No onPress prop → Pressable is disabled. fireEvent.press is a no-op,
    // so neither does it throw nor does any handler fire.
    const { getByText } = render(<AssetListItem {...baseProps} />);
    expect(() => fireEvent.press(getByText('Ether'))).not.toThrow();
  });
});
