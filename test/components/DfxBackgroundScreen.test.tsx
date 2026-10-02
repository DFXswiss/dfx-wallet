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

import { DfxBackgroundScreen } from '../../src/components/DfxBackgroundScreen';

describe('DfxBackgroundScreen', () => {
  it('renders its children inside the background container', () => {
    const { getByText } = render(
      <DfxBackgroundScreen testID="bg">
        <Text>inner</Text>
      </DfxBackgroundScreen>,
    );
    expect(getByText('inner')).toBeTruthy();
  });

  it('exposes the testID on the inner content wrapper', () => {
    const { getByTestId } = render(
      <DfxBackgroundScreen testID="bg-test">
        <Text>inner</Text>
      </DfxBackgroundScreen>,
    );
    expect(getByTestId('bg-test')).toBeTruthy();
  });

  it('supports the scrollable variant without throwing', () => {
    const { getByText } = render(
      <DfxBackgroundScreen scrollable>
        <Text>scroll-content</Text>
      </DfxBackgroundScreen>,
    );
    expect(getByText('scroll-content')).toBeTruthy();
  });
});
