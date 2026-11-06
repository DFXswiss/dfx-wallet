import React from 'react';
import { StyleSheet } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

import { AssetActions } from '../../src/components/AssetActions';

function flattenStyle(style: unknown): Record<string, unknown> {
  const resolved =
    typeof style === 'function'
      ? (style as (args: { pressed: boolean }) => unknown)({ pressed: false })
      : style;
  return StyleSheet.flatten(resolved) as Record<string, unknown>;
}

describe('AssetActions', () => {
  it('gives both pills flex: 1 and does not center the row', () => {
    const { getByTestId } = render(<AssetActions testID="actions" />);
    const buy = flattenStyle(getByTestId('actions-buy').props.style);
    const sell = flattenStyle(getByTestId('actions-sell').props.style);
    expect(buy.flex).toBe(1);
    expect(sell.flex).toBe(1);

    const row = flattenStyle(getByTestId('actions').props.style);
    expect(row.justifyContent).not.toBe('center');
  });
});
