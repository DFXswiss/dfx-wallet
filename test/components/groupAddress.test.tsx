import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import { render } from '@testing-library/react-native';

import { GroupedAddress } from '../../src/features/transfer/GroupedAddress';
import { groupAddress } from '../../src/features/transfer/groupAddress';

describe('groupAddress', () => {
  it('groups a Bitcoin address into balanced lines without changing the original', () => {
    const address = 'bc1q0062y02gmwjpm7mtakafr0tmkl3lahsa6wcuxm';
    const grouped = groupAddress(address);

    expect(grouped.original).toBe(address);
    expect(grouped.groups).toEqual([
      'bc1q',
      '0062',
      'y02g',
      'mwjp',
      'm7mt',
      'akaf',
      'r0tm',
      'kl3l',
      'ahsa',
      '6wcuxm',
    ]);
    expect(grouped.lines).toEqual(['bc1q 0062 y02g mwjp m7mt', 'akaf r0tm kl3l ahsa 6wcuxm']);
    expect(grouped.emphasizedStart).toBe('bc1q');
    expect(grouped.emphasizedEnd).toBe('6wcuxm');
  });

  it('groups an EVM address, exposes the spoken grouping and keeps bold ends', () => {
    const address = '0x5D9254c5947f5a86B2139f49f1801A3B884E81C3';
    const grouped = groupAddress(address);

    expect(grouped.original).toBe(address);
    expect(grouped.groups).toEqual([
      '0x5D',
      '9254',
      'c594',
      '7f5a',
      '86B2',
      '139f',
      '49f1',
      '801A',
      '3B88',
      '4E81C3',
    ]);
    expect(grouped.lines).toEqual(['0x5D 9254 c594 7f5a 86B2', '139f 49f1 801A 3B88 4E81C3']);
    expect(grouped.accessibilityLabel).toBe('0x5D 9254 c594 7f5a 86B2 139f 49f1 801A 3B88 4E81C3');
    expect(grouped.emphasizedStart).toBe('0x5D');
    expect(grouped.emphasizedEnd).toBe('4E81C3');
  });

  it('renders bold start/end characters while the selectable layer keeps the original', () => {
    const address = 'bc1q0062y02gmwjpm7mtakafr0tmkl3lahsa6wcuxm';
    const { getByTestId, UNSAFE_getAllByType } = render(
      <GroupedAddress address={address} testID="address" />,
    );
    const emphasized = UNSAFE_getAllByType(Text)
      .filter(
        (node) =>
          StyleSheet.flatten(node.props.style as StyleProp<TextStyle>)?.fontWeight === '800',
      )
      .map((node) => node.props.children)
      .join('');

    expect(emphasized).toBe('bc1q6wcuxm');
    expect(getByTestId('address').props.children).toBe(address);
    expect(getByTestId('address').props.selectable).toBe(true);
  });

  it('renders overlapping bold ends once for a short address', () => {
    const address = 'abc';
    const { UNSAFE_getAllByType } = render(<GroupedAddress address={address} />);
    const emphasized = UNSAFE_getAllByType(Text)
      .filter(
        (node) =>
          StyleSheet.flatten(node.props.style as StyleProp<TextStyle>)?.fontWeight === '800',
      )
      .map((node) => node.props.children)
      .join('');

    expect(emphasized).toBe(address);
  });
});
