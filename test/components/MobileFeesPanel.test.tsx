import { fireEvent, render, within } from '@testing-library/react-native';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/theme', () => ({
  useColors: () => ({
    cardOverlay: '#fff',
    border: '#ddd',
    primary: '#06f',
    primaryLight: '#def',
    text: '#111',
    textSecondary: '#555',
    textTertiary: '#888',
    success: '#16a34a',
  }),
}));

jest.mock('@/components/Icon', () => ({
  Icon: () => null,
}));

import { MobileFeesPanel } from '../../src/features/buy-sell/MobileFeesPanel';
import {
  makeTradeQuoteKey,
  SELECTOR_PILL_LAYOUT,
} from '../../src/features/buy-sell/tradePanelStyles';

const quote = {
  amount: 0.01,
  estimatedAmount: 250,
  exchangeRate: 25000,
  rate: 0.00004,
  isValid: true,
  fees: {
    rate: 0.01,
    dfx: 9,
    bank: 9,
    network: 9,
    fixed: 0,
    min: 0,
    platform: 0,
    total: 27,
  },
  feesTarget: {
    rate: 0.02,
    dfx: 2,
    bank: 0,
    network: 0,
    fixed: 0,
    min: 0,
    platform: 0,
    total: 2,
  },
};

describe('MobileFeesPanel', () => {
  it('defines one shared selector geometry for both sides of the trade', () => {
    expect(SELECTOR_PILL_LAYOUT).toEqual({
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: '46%',
      maxWidth: '46%',
      minWidth: 0,
    });
  });

  it('includes every quote input in the freshness key', () => {
    const input = {
      amount: 1,
      currency: 'CHF',
      asset: 'BTC',
      blockchain: 'Bitcoin',
      chain: 'bitcoin',
    };
    const key = makeTradeQuoteKey(input);

    expect(key).toBe('1|CHF|BTC|Bitcoin|bitcoin');
    expect(makeTradeQuoteKey({ ...input, amount: 2 })).not.toBe(key);
    expect(makeTradeQuoteKey({ ...input, currency: 'EUR' })).not.toBe(key);
    expect(makeTradeQuoteKey({ ...input, asset: 'ZCHF' })).not.toBe(key);
    expect(makeTradeQuoteKey({ ...input, blockchain: 'Ethereum' })).not.toBe(key);
    expect(makeTradeQuoteKey({ ...input, chain: 'ethereum' })).not.toBe(key);
  });

  it('renders Sell feesTarget with Free, Included, negative values, and stable row order', () => {
    const { getByTestId, getByRole, rerender } = render(
      <MobileFeesPanel
        mode="sell"
        quote={quote}
        payAssetCode="BTC"
        receiveAssetCode=""
        currencyCode="CHF"
        expanded={false}
        onToggle={jest.fn()}
        testID="fees"
      />,
    );

    fireEvent.press(getByRole('button'));
    rerender(
      <MobileFeesPanel
        mode="sell"
        quote={quote}
        payAssetCode="BTC"
        receiveAssetCode=""
        currencyCode="CHF"
        expanded
        onToggle={jest.fn()}
        testID="fees"
      />,
    );
    const panel = getByTestId('fees');
    const labels = within(panel).getAllByText(
      /buy\.youPay|sell\.feeDfx|sell\.feeBank|sell\.feeNetwork|sell\.feeTotal|sell\.exchangeRate|sell\.youReceive/,
    );
    expect(labels.map((node) => node.props.children)).toEqual([
      'buy.youPay',
      'sell.feeDfx · 2.00%',
      'sell.feeBank',
      'sell.feeNetwork',
      'sell.feeTotal',
      'sell.exchangeRate',
      'sell.youReceive',
    ]);
    expect(within(panel).getByText('common.free')).toBeTruthy();
    expect(within(panel).getByText('common.included')).toBeTruthy();
    expect(within(panel).getAllByText('−2.00 CHF')).toHaveLength(2);
    expect(within(panel).queryByText('−9.00 CHF')).toBeNull();
    expect(within(panel).queryByText('sell.feeFixed')).toBeNull();
  });

  it('renders the empty summary and empty body without a quote', () => {
    const { getByTestId, getAllByText } = render(
      <MobileFeesPanel
        mode="swap"
        quote={null}
        payAssetCode=""
        receiveAssetCode=""
        currencyCode=""
        expanded={true}
        onToggle={jest.fn()}
        testID="empty-fees"
      />,
    );

    expect(getByTestId('empty-fees')).toBeTruthy();
    expect(getAllByText('—')).toHaveLength(2);
  });

  it('renders an invalid-quote status below the empty summary when expanded', () => {
    const { getByText } = render(
      <MobileFeesPanel
        mode="buy"
        quote={null}
        payAssetCode=""
        receiveAssetCode="BTC"
        currencyCode="CHF"
        expanded
        onToggle={jest.fn()}
        statusMessage="buy.continueHint"
        testID="status-fees"
      />,
    );

    expect(getByText('buy.continueHint')).toBeTruthy();
  });

  it('renders a current action status alongside valid fee rows and clears it on retry', () => {
    const { getByTestId, getByText, queryByText, rerender } = render(
      <MobileFeesPanel
        mode="buy"
        quote={quote}
        payAssetCode="CHF"
        receiveAssetCode="BTC"
        currencyCode="CHF"
        expanded
        onToggle={jest.fn()}
        statusMessage="payment info failed"
        testID="action-fees"
      />,
    );

    expect(getByTestId('action-fees')).toBeTruthy();
    expect(getByText('payment info failed')).toBeTruthy();
    expect(getByText('buy.youPay')).toBeTruthy();
    expect(getByText('buy.youReceive')).toBeTruthy();

    rerender(
      <MobileFeesPanel
        mode="buy"
        quote={quote}
        payAssetCode="CHF"
        receiveAssetCode="BTC"
        currencyCode="CHF"
        expanded
        onToggle={jest.fn()}
        testID="action-fees"
      />,
    );

    expect(queryByText('payment info failed')).toBeNull();
    expect(getByText('buy.youPay')).toBeTruthy();
  });
});
