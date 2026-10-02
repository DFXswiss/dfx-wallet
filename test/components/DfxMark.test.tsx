import { render } from '@testing-library/react-native';
import { Circle, Path } from 'react-native-svg';

import { DfxMark } from '../../src/components/DfxMark';

describe('DfxMark', () => {
  it('renders the original D path and both gradient circles in a square', () => {
    const { UNSAFE_getAllByType, UNSAFE_getByType } = render(<DfxMark size={34} color="#123456" />);
    const mark = UNSAFE_getByType(Path);

    expect(mark.props.fill).toBe('#123456');
    expect(mark.props.d).not.toContain('M266.25');
    expect(UNSAFE_getAllByType(Circle)).toHaveLength(2);
  });
});
