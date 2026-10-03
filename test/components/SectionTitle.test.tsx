import { StyleSheet, type StyleProp, type TextStyle } from 'react-native';
import { render } from '@testing-library/react-native';
import { SectionTitle } from '../../src/components/SectionTitle';
import { Spacing } from '@/theme';

function flatten(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as StyleProp<TextStyle>) as Record<string, unknown>;
}

describe('SectionTitle', () => {
  it('renders the given title', () => {
    const { getByText } = render(<SectionTitle title="Bank account" />);
    expect(getByText('Bank account')).toBeTruthy();
  });

  it('uses the uppercase, letter-spaced label style (matching the former Settings sectionTitle)', () => {
    const { getByText } = render(<SectionTitle title="Bank account" />);
    const style = flatten(getByText('Bank account').props.style);
    expect(style.textTransform).toBe('uppercase');
    expect(style.fontWeight).toBe('700');
    expect(style.letterSpacing).toBe(1.5);
    expect(style.paddingHorizontal).toBe(Spacing.xs);
  });

  it('forwards testID when given', () => {
    const { getByTestId } = render(<SectionTitle title="Bank account" testID="section-title" />);
    expect(getByTestId('section-title')).toBeTruthy();
  });
});
