import React from 'react';
import { act, render, waitFor } from '@testing-library/react-native';
import { TransactionRow } from '@/components/TransactionRow';
import type { TransactionDto } from '@/features/dfx-backend/services';
import { FiatCurrency, pricingService } from '@/services/pricing-service';
import { useWalletStore } from '@/store';
import { ThemeProvider, useThemeStore } from '@/theme';

const transaction: TransactionDto = {
  id: 1,
  type: 'Pay',
  state: 'Completed',
  inputAmount: 2,
  inputAsset: 'BTC',
  outputAmount: 2,
  outputAsset: 'BTC',
  date: '2025-05-01T10:00:00.000Z',
  counterparty: 'Test merchant',
};

describe('TransactionRow', () => {
  let btcRate = 50_000;

  beforeEach(() => {
    btcRate = 50_000;
    useWalletStore.getState().reset();
    useWalletStore.setState({ selectedCurrency: 'USD' });
    useThemeStore.setState({ mode: 'light' });
    jest.spyOn(pricingService, 'isReady').mockReturnValue(true);
    jest.spyOn(pricingService, 'initialize').mockResolvedValue(undefined);
    jest.spyOn(pricingService, 'getExchangeRate').mockImplementation((ticker, currency) =>
      ticker === 'btc' && currency === FiatCurrency.USD ? btcRate : undefined,
    );
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('recomputes the fiat estimate when the pricing service publishes an update', async () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <TransactionRow tx={transaction} testID="transaction" />
      </ThemeProvider>,
    );
    const subtitle = () => String(getByTestId('transaction-subtitle').props.children);
    expect(subtitle()).toContain('≈ $ 100000.00');

    btcRate = 60_000;
    act(() => pricingService.reset());

    await waitFor(() => expect(subtitle()).toContain('≈ $ 120000.00'));
  });
});
