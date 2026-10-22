/**
 * Chip colors used to come from a component-local `isDark ? … : …` branch
 * in `makeTypeIcon`. They now come straight off `ThemeColors` (see
 * `colors.ts`'s `<type>ChipBg`/`payChipFg` tokens) — this test pins the
 * exact same values the old literals held, in both schemes, so the token
 * move is provably value-for-value.
 */
import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { render } from '@testing-library/react-native';
import { TransactionRow } from '../../src/components/TransactionRow';
import { Icon } from '../../src/components/Icon';
import type { TransactionDto } from '@/features/dfx-backend/services';
import { pricingService } from '@/services/pricing-service';
import { ThemeProvider, useThemeStore, lightColors, darkColors, type ThemeColors } from '@/theme';

function makeTx(type: TransactionDto['type']): TransactionDto {
  return {
    id: 1,
    type,
    state: 'Completed',
    inputAmount: 1,
    inputAsset: 'XXX',
    outputAmount: 1,
    // An asset symbol with no canonical mapping — keeps the fiat-estimate
    // path (pricingService) out of this test entirely.
    outputAsset: 'XXX',
    date: '2024-01-01T00:00:00.000Z',
  };
}

function flatten(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as StyleProp<ViewStyle>) as Record<string, unknown>;
}

type Expectation = { fg: keyof ThemeColors; bg: keyof ThemeColors };

const EXPECTED: Record<TransactionDto['type'], Expectation> = {
  Buy: { fg: 'success', bg: 'buyChipBg' },
  Sell: { fg: 'error', bg: 'sellChipBg' },
  Swap: { fg: 'primary', bg: 'swapChipBg' },
  Pay: { fg: 'payChipFg', bg: 'payChipBg' },
  Send: { fg: 'error', bg: 'sendChipBg' },
  Receive: { fg: 'success', bg: 'receiveChipBg' },
};

describe.each([
  ['light', lightColors],
  ['dark', darkColors],
] as const)('TransactionRow chip colors — %s scheme', (mode, colors) => {
  beforeEach(() => {
    useThemeStore.setState({ mode });
    // `outputAsset: 'XXX'` already keeps the fiat estimate at 0 without
    // this, but stub `isReady` too so the mount effect never fires a real
    // `initialize()` network call.
    jest.spyOn(pricingService, 'isReady').mockReturnValue(true);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(Object.entries(EXPECTED) as [TransactionDto['type'], Expectation][])(
    'renders the pre-move colors for type %s',
    (type, expectation) => {
      const { UNSAFE_getByType } = render(
        <ThemeProvider>
          <TransactionRow tx={makeTx(type)} />
        </ThemeProvider>,
      );
      const icon = UNSAFE_getByType(Icon);
      expect(icon.props.color).toBe(colors[expectation.fg]);

      const container = icon.parent;
      if (!container) throw new Error('icon container not found');
      expect(flatten(container.props.style).backgroundColor).toBe(colors[expectation.bg]);
    },
  );
});
