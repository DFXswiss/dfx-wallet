import { ActivityIndicator, Text } from 'react-native';
import { render, fireEvent } from '@testing-library/react-native';
import { PrimaryButton } from '../../src/components/PrimaryButton';

describe('PrimaryButton', () => {
  it('renders the title text in the filled (default) variant', () => {
    const { getByText } = render(<PrimaryButton title="Continue" onPress={() => {}} />);
    expect(getByText('Continue')).toBeTruthy();
  });

  it('calls onPress when pressed', () => {
    const onPress = jest.fn();
    const { getByText } = render(<PrimaryButton title="Continue" onPress={onPress} />);
    fireEvent.press(getByText('Continue'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('does not call onPress when disabled', () => {
    const onPress = jest.fn();
    const { getByText } = render(<PrimaryButton title="Continue" onPress={onPress} disabled />);
    fireEvent.press(getByText('Continue'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('does not call onPress while loading and shows a spinner instead of the title', () => {
    const onPress = jest.fn();
    const { queryByText, UNSAFE_getByType } = render(
      <PrimaryButton title="Continue" onPress={onPress} loading />,
    );
    // ActivityIndicator is rendered, the title text is replaced
    expect(queryByText('Continue')).toBeNull();
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('renders the outlined variant', () => {
    const { getByText } = render(
      <PrimaryButton title="Cancel" variant="outlined" onPress={() => {}} />,
    );
    expect(getByText('Cancel')).toBeTruthy();
  });

  it('renders an optional icon next to the title', () => {
    const { getByText } = render(
      <PrimaryButton title="Buy BTC" icon={<Text>icon</Text>} onPress={() => {}} />,
    );
    expect(getByText('Buy BTC')).toBeTruthy();
    expect(getByText('icon')).toBeTruthy();
  });

  it('renders no icon when the icon prop is omitted (existing callers stay unaffected)', () => {
    const { queryByText } = render(<PrimaryButton title="Continue" onPress={() => {}} />);
    expect(queryByText('icon')).toBeNull();
  });

  it('hides the icon while loading, showing only the spinner', () => {
    const { queryByText, UNSAFE_getByType } = render(
      <PrimaryButton title="Buy BTC" icon={<Text>icon</Text>} onPress={() => {}} loading />,
    );
    expect(queryByText('Buy BTC')).toBeNull();
    expect(queryByText('icon')).toBeNull();
    expect(UNSAFE_getByType(ActivityIndicator)).toBeTruthy();
  });
});
