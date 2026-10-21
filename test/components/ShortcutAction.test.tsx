import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ShortcutAction } from '../../src/components/ShortcutAction';

describe('ShortcutAction', () => {
  it('renders the label text', () => {
    const { getByText } = render(
      <ShortcutAction icon={<Text>★</Text>} label="Send" onPress={() => undefined} />,
    );
    expect(getByText('Send')).toBeTruthy();
    expect(getByText('★')).toBeTruthy();
  });

  it('fires onPress when tapped', () => {
    const onPress = jest.fn();
    const { getByText } = render(
      <ShortcutAction icon={<Text>★</Text>} label="Send" onPress={onPress} testID="send-btn" />,
    );
    fireEvent.press(getByText('Send'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('exposes the testID on the pressable wrapper', () => {
    const { getByTestId } = render(
      <ShortcutAction
        icon={<Text>★</Text>}
        label="Send"
        onPress={() => undefined}
        testID="send-btn"
      />,
    );
    expect(getByTestId('send-btn')).toBeTruthy();
  });
});
