import React from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import type { ReactTestInstance } from 'react-test-renderer';

jest.mock('expo-blur', () => {
  const { View: RNView } = jest.requireActual('react-native');
  function BlurView(props: { children?: React.ReactNode }) {
    return <RNView {...props} />;
  }
  return { BlurView };
});

// eslint-disable-next-line import/first
import { GlassListGroup } from '../../src/components/GlassListGroup';
// eslint-disable-next-line import/first
import { Card, Interaction, ThemeProvider, useThemeStore, lightColors } from '@/theme';

function flatten(style: unknown): Record<string, unknown> {
  return StyleSheet.flatten(style as StyleProp<ViewStyle>) as Record<string, unknown>;
}

// `getByTestId('row')` resolves to the Pressable, which never receives a
// `style` prop in `GlassListGroup.Row` (only its rendered content `View`
// does) — so the actual row box is found by its stable `paddingHorizontal`
// marker (`Card.padding`, present regardless of pressed/disabled state).
function findRowContentView(views: readonly ReactTestInstance[]): ReactTestInstance {
  const match = views.find((v) => flatten(v.props.style)?.paddingHorizontal === Card.padding);
  if (!match) throw new Error('row content view not found');
  return match;
}

function renderGroup() {
  return render(
    <ThemeProvider>
      <GlassListGroup testID="group">
        <GlassListGroup.Row testID="row-1">
          <Text>one</Text>
        </GlassListGroup.Row>
        <GlassListGroup.Row testID="row-2" last>
          <Text>two</Text>
        </GlassListGroup.Row>
      </GlassListGroup>
    </ThemeProvider>,
  );
}

describe('GlassListGroup', () => {
  beforeEach(() => useThemeStore.setState({ mode: 'light' }));

  it('renders a divider on every row except the one marked last', () => {
    const { getByTestId } = renderGroup();
    const row1 = flatten(getByTestId('row-1').props.style);
    const row2 = flatten(getByTestId('row-2').props.style);
    expect(row1.borderBottomColor).toBe(lightColors.divider);
    expect(row2.borderBottomColor).toBeUndefined();
  });

  it('renders a Pressable row (not a plain View) when onPress is given, and fires it', () => {
    const onPress = jest.fn();
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassListGroup>
          <GlassListGroup.Row testID="pressable-row" onPress={onPress} last>
            <Text>tap me</Text>
          </GlassListGroup.Row>
        </GlassListGroup>
      </ThemeProvider>,
    );
    fireEvent.press(getByTestId('pressable-row'));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('passes accessibility props through to the row Pressable', () => {
    const { getByLabelText } = render(
      <ThemeProvider>
        <GlassListGroup>
          <GlassListGroup.Row
            onPress={() => undefined}
            accessibilityRole="button"
            accessibilityLabel="Delete wallet"
            accessibilityHint="Removes the wallet"
            last
          >
            <Text>Delete</Text>
          </GlassListGroup.Row>
        </GlassListGroup>
      </ThemeProvider>,
    );
    const node = getByLabelText('Delete wallet');
    expect(node.props.accessibilityRole).toBe('button');
    expect(node.props.accessibilityHint).toBe('Removes the wallet');
  });

  it('disabled row: drops the callback and dims by Interaction.disabledOpacity', () => {
    const onPress = jest.fn();
    const { getByTestId, UNSAFE_getAllByType } = render(
      <ThemeProvider>
        <GlassListGroup>
          <GlassListGroup.Row testID="row" onPress={onPress} disabled last>
            <Text>Active wallet</Text>
          </GlassListGroup.Row>
        </GlassListGroup>
      </ThemeProvider>,
    );
    fireEvent.press(getByTestId('row'));
    expect(onPress).not.toHaveBeenCalled();

    const contentView = findRowContentView(UNSAFE_getAllByType(View));
    expect(flatten(contentView.props.style).opacity).toBe(Interaction.disabledOpacity);
  });

  it('pressed row: tints its background with the "lead" glass overlay recipe', () => {
    const { getByTestId, UNSAFE_getAllByType } = render(
      <ThemeProvider>
        <GlassListGroup>
          <GlassListGroup.Row testID="row" onPress={() => undefined} last>
            <Text>Row</Text>
          </GlassListGroup.Row>
        </GlassListGroup>
      </ThemeProvider>,
    );
    fireEvent(getByTestId('row'), 'pressIn');
    const pressedView = findRowContentView(UNSAFE_getAllByType(View));
    // Light "lead" overlay from the glass recipe — see src/theme/glass.ts.
    expect(flatten(pressedView.props.style).backgroundColor).toBe('rgba(255,255,255,0.32)');

    fireEvent(getByTestId('row'), 'pressOut');
    const restingView = findRowContentView(UNSAFE_getAllByType(View));
    expect(flatten(restingView.props.style).backgroundColor).toBeUndefined();
  });

  it('tone tints the group edge with the theme token', () => {
    const { getByTestId } = render(
      <ThemeProvider>
        <GlassListGroup testID="group" tone="danger">
          <GlassListGroup.Row testID="row-1" last>
            <Text>one</Text>
          </GlassListGroup.Row>
        </GlassListGroup>
      </ThemeProvider>,
    );
    const style = flatten(getByTestId('group').props.style);
    expect(style.borderColor).toBe(lightColors.error);
    expect(style.borderWidth).toBe(Card.borderWidth + 0.5);
  });
});
