import React from 'react';
import { render } from '@testing-library/react-native';
import { Icon } from '../../src/components/Icon';

// Every icon name in the union — the test runs each through `render` so
// future contributions (adding a new variant) catch syntactic errors at
// least, even if no screen yet uses the new icon.
const NAMES = [
  'menu',
  'eye',
  'eye-off',
  'wallet',
  'grid',
  'chevron-right',
  'swap',
  'send',
  'receive',
  'close',
  'lightning',
  'arrow-left',
  'user',
  'shield',
  'globe',
  'document',
  'support',
  'arrow-down',
  'arrow-up',
  'storefront',
  'check',
  'copy',
  'edit',
] as const;

describe('Icon', () => {
  it.each(NAMES)('renders the "%s" variant without crashing', (name) => {
    expect(() => render(<Icon name={name} />)).not.toThrow();
  });

  it('passes through custom size + color + strokeWidth', () => {
    expect(() =>
      render(<Icon name="menu" size={48} color="#ff0000" strokeWidth={3} />),
    ).not.toThrow();
  });
});
