import { ActivityIndicator } from 'react-native';
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
    const { getByText } = render(
      <PrimaryButton title="Continue" onPress={onPress} disabled />,
    );
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
});
