import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';

jest.mock('react-native-safe-area-context', () => {
  const { View } = jest.requireActual('react-native');
  return {
    SafeAreaView: ({ children, ...rest }: { children?: React.ReactNode }) => (
      <View {...rest}>{children}</View>
    ),
    SafeAreaProvider: ({ children }: { children?: React.ReactNode }) => <View>{children}</View>,
  };
});

import { ScreenContainer } from '../../src/components/ScreenContainer';

describe('ScreenContainer', () => {
  it('renders its children in the default (non-scrollable) variant', () => {
    const { getByText } = render(
      <ScreenContainer>
        <Text>inner</Text>
      </ScreenContainer>,
    );
    expect(getByText('inner')).toBeTruthy();
  });

  it('renders its children when `scrollable` is true', () => {
    const { getByText } = render(
      <ScreenContainer scrollable>
        <Text>inner-scrollable</Text>
      </ScreenContainer>,
    );
    expect(getByText('inner-scrollable')).toBeTruthy();
  });

  it('propagates testID to the outer safe-area wrapper', () => {
    const { getByTestId } = render(
      <ScreenContainer testID="screen-wrap">
        <Text>x</Text>
      </ScreenContainer>,
    );
    expect(getByTestId('screen-wrap')).toBeTruthy();
  });
});
