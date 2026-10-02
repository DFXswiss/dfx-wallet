import React from 'react';
import { render } from '@testing-library/react-native';
import { OnboardingStepIndicator } from '../../src/components/OnboardingStepIndicator';

describe('OnboardingStepIndicator', () => {
  it('renders the default 3 segments', () => {
    const { UNSAFE_getAllByType } = render(<OnboardingStepIndicator current={1} />);
    // Container is a View, each step is also a View; the indicator
    // renders 1 (container) + total (steps) Views.
    const { View } = jest.requireActual('react-native');
    const views = UNSAFE_getAllByType(View);
    // 1 container + 3 step rectangles.
    expect(views.length).toBeGreaterThanOrEqual(4);
  });

  it('renders the given `total` segments when provided', () => {
    const { UNSAFE_getAllByType } = render(
      <OnboardingStepIndicator current={2} total={5} />,
    );
    const { View } = jest.requireActual('react-native');
    const views = UNSAFE_getAllByType(View);
    // 1 container + 5 steps.
    expect(views.length).toBeGreaterThanOrEqual(6);
  });

  it('renders without crashing for edge cases (current=0, current>total)', () => {
    expect(() => render(<OnboardingStepIndicator current={0} />)).not.toThrow();
    expect(() => render(<OnboardingStepIndicator current={99} total={3} />)).not.toThrow();
  });
});
