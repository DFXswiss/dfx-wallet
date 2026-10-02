import { fireEvent, render, within } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { MobileFeesPanel } from '../../src/features/buy-sell/MobileFeesPanel';
import {
  makeTradeQuoteKey,
  SELECTOR_PILL_LAYOUT,
} from '../../src/features/buy-sell/tradePanelStyles';
import {
  TradeAmountPanels,
  TradeSelectorPill,
} from '../../src/features/buy-sell/TradeAmountPanels';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/theme', () => {
  const actual = jest.requireActual('@/theme');
  return {
    ...actual,
    useColors: () => ({
      cardOverlay: '#fff',
      border: '#ddd',
      primary: '#06f',
      primaryLight: '#def',
      text: '#111',
      textSecondary: '#555',
      textTertiary: '#888',
      success: '#16a34a',
      card: '#f8f8f8',
      surface: '#ffffff',
      surfaceLight: '#f2f2f2',
      divider: '#dddddd',
    }),
  };
});

jest.mock('@/components/Icon', () => ({
  Icon: () => null,
}));

const quote = {
  amount: 0.01,
  estimatedAmount: 689.46,
  exchangeRate: 0.000014271,
  rate: 0.000014504,
  isValid: true,
  fees: {
    rate: 0.016065,
    dfx: 0.000103,
    bank: 0.0000285,
    network: 0.00002915,
    fixed: 0,
    min: 0,
    platform: 0,
    total: 0.00016065,
  },
  feesTarget: {
    rate: 0.016065,
    dfx: 7.22,
    bank: 2,
    network: 2.04,
    fixed: 0,
    min: 0,
    platform: 0,
    total: 11.26,
  },
};

describe('MobileFeesPanel', () => {
  it('defines one shared selector geometry for both sides of the trade', () => {
    expect(SELECTOR_PILL_LAYOUT).toEqual({
      flexGrow: 0,
      flexShrink: 0,
      flexBasis: 152,
      maxWidth: 152,
      minWidth: 152,
      width: 152,
      height: 48,
    });
  });

  it('uses shared fixed selector and flip geometry for every trade mode', () => {
    const { getByTestId } = render(
      <TradeAmountPanels
        testID="shared-panels"
        flipTestID="shared-flip"
        flipAccessibilityLabel="flip"
        payLabel={<Text>pay</Text>}
        payAmount={<Text>0</Text>}
        paySelector={<TradeSelectorPill testID="shared-pay">—</TradeSelectorPill>}
        receiveLabel={<Text>receive</Text>}
        receiveAmount={<Text>0</Text>}
        receiveSelector={<TradeSelectorPill testID="shared-receive">—</TradeSelectorPill>}
      />,
    );

    expect(StyleSheet.flatten(getByTestId('shared-pay').props.style)).toMatchObject({
      width: 152,
      height: 48,
      flexBasis: 152,
      maxWidth: 152,
      minWidth: 152,
    });
    expect(StyleSheet.flatten(getByTestId('shared-receive').props.style)).toMatchObject({
      width: 152,
      height: 48,
      flexBasis: 152,
      maxWidth: 152,
      minWidth: 152,
    });
    expect(StyleSheet.flatten(getByTestId('shared-flip').props.style)).toMatchObject({
      width: 40,
      height: 40,
      borderRadius: 13,
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

  it('renders the inverse Sell rates and only positive feesTarget rows in stable order', () => {
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
    expect(
      within(getByTestId('fees')).getByText(/^1 BTC ≈ 68['’]946\.50 CHF \(common\.inclFees\)$/),
    ).toBeTruthy();

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
      'sell.feeDfx · 1.61%',
      'sell.feeNetwork',
      'sell.feeBank',
      'sell.feeTotal',
      'sell.exchangeRate',
      'sell.youReceive',
    ]);
    expect(within(panel).getByText('−7.22 CHF')).toBeTruthy();
    expect(within(panel).getByText('−2.04 CHF')).toBeTruthy();
    expect(within(panel).getByText('−2.00 CHF')).toBeTruthy();
    expect(within(panel).getByText('−11.26 CHF')).toBeTruthy();
    expect(within(panel).getByText(/^1 BTC = 70['’]072\.17 CHF$/)).toBeTruthy();
    expect(within(panel).queryByText('common.free')).toBeNull();
    expect(within(panel).queryByText('common.included')).toBeNull();
    expect(within(panel).queryByText('sell.feeFixed')).toBeNull();
  });

  it('does not fall back to source-asset fees when Sell feesTarget is absent', () => {
    const { feesTarget: omittedFeesTarget, ...quoteWithoutTarget } = quote;
    void omittedFeesTarget;

    const { getAllByText, queryByText } = render(
      <MobileFeesPanel
        mode="sell"
        quote={quoteWithoutTarget}
        payAssetCode="BTC"
        receiveAssetCode=""
        currencyCode="CHF"
        expanded
        onToggle={jest.fn()}
        testID="fees-without-target"
      />,
    );

    expect(getAllByText('—')).toHaveLength(2);
    expect(queryByText('−0.00 CHF')).toBeNull();
    expect(queryByText('sell.feeTotal')).toBeNull();
  });

  it('renders a positive Sell fixed fee from feesTarget', () => {
    const { getByText } = render(
      <MobileFeesPanel
        mode="sell"
        quote={{
          ...quote,
          feesTarget: { ...quote.feesTarget, fixed: 3, total: 14.26 },
        }}
        payAssetCode="BTC"
        receiveAssetCode=""
        currencyCode="CHF"
        expanded
        onToggle={jest.fn()}
        testID="fees-with-fixed"
      />,
    );

    expect([
      getByText('sell.feeFixed').props.children,
      getByText('−3.00 CHF').props.children,
    ]).toEqual(['sell.feeFixed', '−3.00 CHF']);
  });

  it('omits the Sell market-rate row when exchangeRate is not positive', () => {
    const { queryByText } = render(
      <MobileFeesPanel
        mode="sell"
        quote={{ ...quote, exchangeRate: 0 }}
        payAssetCode="BTC"
        receiveAssetCode=""
        currencyCode="CHF"
        expanded
        onToggle={jest.fn()}
        testID="fees-without-rate"
      />,
    );

    expect(queryByText('sell.exchangeRate')).toBeNull();
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
