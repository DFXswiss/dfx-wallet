import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { fireEvent, render, type RenderAPI } from '@testing-library/react-native';

jest.mock('expo-blur', () => {
  const { View: RNView } = jest.requireActual('react-native');
  function BlurView(props: { children?: React.ReactNode }) {
    return <RNView {...props} />;
  }
  return { BlurView };
});

// eslint-disable-next-line import/first
import { GlassInputField } from '../../src/components/GlassInputField';
// eslint-disable-next-line import/first
import { ThemeProvider, useThemeStore, lightColors } from '@/theme';

function flatten(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as StyleProp<ViewStyle>) as Record<string, unknown>;
}

// The ring `View` is the only node in the tree with an explicit
// `borderWidth` — `GlassSurface`'s own root view carries shadow/radius but
// no border, so this uniquely finds the ring regardless of internal glass
// markup.
function ringStyle(result: RenderAPI): Record<string, unknown> {
  const view = result.UNSAFE_getAllByType(View).find((node) => {
    const style = flatten(node.props.style);
    return style.borderWidth !== undefined;
  });
  if (!view) throw new Error('ring view not found');
  return flatten(view.props.style);
}

describe('GlassInputField', () => {
  beforeEach(() => useThemeStore.setState({ mode: 'light' }));

  it('forwards standard TextInput props (value, onChangeText, placeholder)', () => {
    const onChangeText = jest.fn();
    const { getByTestId, getByPlaceholderText } = render(
      <ThemeProvider>
        <GlassInputField
          testID="input"
          value="hello"
          onChangeText={onChangeText}
          placeholder="Name"
        />
      </ThemeProvider>,
    );
    expect(getByPlaceholderText('Name').props.value).toBe('hello');
    fireEvent.changeText(getByTestId('input'), 'world');
    expect(onChangeText).toHaveBeenCalledWith('world');
  });

  it('tints the ring colors.error when error is set, colors.transparent otherwise', () => {
    const clean = render(
      <ThemeProvider>
        <GlassInputField />
      </ThemeProvider>,
    );
    expect(ringStyle(clean).borderColor).toBe(lightColors.transparent);
    clean.unmount();

    const withError = render(
      <ThemeProvider>
        <GlassInputField error />
      </ThemeProvider>,
    );
    expect(ringStyle(withError).borderColor).toBe(lightColors.error);
  });
});
