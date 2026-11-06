import { Animated } from 'react-native';
import { render } from '@testing-library/react-native';

let mockReduceMotion = false;

jest.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

jest.mock('@/hooks', () => ({
  useReduceMotion: () => mockReduceMotion,
}));

jest.mock('@/theme', () => ({
  useColors: () => ({ background: '#ffffff' }),
  useResolvedScheme: () => 'light',
}));

import { DfxLogoLoader } from '../../src/components/DfxLogoLoader';

describe('DfxLogoLoader', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders as a labelled progressbar', () => {
    mockReduceMotion = true;

    const { getByRole } = render(<DfxLogoLoader />);

    expect(getByRole('progressbar', { name: 'pin.processing' })).toBeTruthy();
  });

  it('does not start a loop when reduce motion is enabled', () => {
    mockReduceMotion = true;
    const loopSpy = jest.spyOn(Animated, 'loop');

    render(<DfxLogoLoader />);

    expect(loopSpy).not.toHaveBeenCalled();
  });

  it('starts exactly one loop when reduce motion is disabled', () => {
    mockReduceMotion = false;
    const animation = {
      start: jest.fn(),
      stop: jest.fn(),
      reset: jest.fn(),
    };
    const loopSpy = jest.spyOn(Animated, 'loop').mockReturnValue(animation);

    const { unmount } = render(<DfxLogoLoader />);

    expect(loopSpy).toHaveBeenCalledTimes(1);
    expect(animation.start).toHaveBeenCalledTimes(1);

    unmount();
    expect(animation.stop).toHaveBeenCalledTimes(1);
  });

  it('drives the loop with a 2400ms native-driver timing animation', () => {
    mockReduceMotion = false;
    const animation = {
      start: jest.fn(),
      stop: jest.fn(),
      reset: jest.fn(),
    };
    jest.spyOn(Animated, 'loop').mockReturnValue(animation);
    const timingSpy = jest.spyOn(Animated, 'timing');

    render(<DfxLogoLoader />);

    expect(timingSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        toValue: 1,
        duration: 2400,
        useNativeDriver: true,
      }),
    );
  });
});
