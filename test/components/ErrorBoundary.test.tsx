import React from 'react';
import { Text } from 'react-native';
import { fireEvent, render } from '@testing-library/react-native';
import { ErrorBoundary } from '../../src/components/ErrorBoundary';

function Boom({ message }: { message: string }): React.ReactElement {
  throw new Error(message);
}

describe('ErrorBoundary', () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    // React logs the caught error via console.error; silence it so the
    // test output stays clean. We still verify the fallback rendered.
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it('renders its children when no error is thrown', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Text>healthy child</Text>
      </ErrorBoundary>,
    );
    expect(getByText('healthy child')).toBeTruthy();
  });

  it('catches a thrown error and renders the fallback with the error message', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <Boom message="kaboom" />
      </ErrorBoundary>,
    );
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('kaboom')).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('renders the fallback even when the thrown error has no message', () => {
    function ThrowsEmpty(): React.ReactElement {
      throw new Error();
    }
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowsEmpty />
      </ErrorBoundary>,
    );
    // Title + reset CTA are always present; the message body collapses to
    // an empty string when the Error has no `message` (the boundary uses
    // `??` which only swaps for null / undefined, not `""`).
    expect(getByText('Something went wrong')).toBeTruthy();
    expect(getByText('Try Again')).toBeTruthy();
  });

  it('clears the error and re-renders the children when "Try Again" is pressed', () => {
    // First render the boundary with a child that will throw the first time
    // and succeed on the second pass.
    let shouldThrow = true;
    function FlakyChild(): React.ReactElement {
      if (shouldThrow) throw new Error('first time fails');
      return <Text>recovered</Text>;
    }
    const { getByText, rerender } = render(
      <ErrorBoundary>
        <FlakyChild />
      </ErrorBoundary>,
    );
    expect(getByText('Something went wrong')).toBeTruthy();

    // Flip the flag, press the reset button, and re-render — the boundary
    // resets state and the freshly-rendered child no longer throws.
    shouldThrow = false;
    fireEvent.press(getByText('Try Again'));
    rerender(
      <ErrorBoundary>
        <FlakyChild />
      </ErrorBoundary>,
    );
    expect(getByText('recovered')).toBeTruthy();
  });
});
