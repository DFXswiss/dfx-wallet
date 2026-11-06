const mockResolveIncomingPath = jest.fn();

jest.mock('@/config/deep-links', () => ({
  resolveIncomingPath: (path: string, initial: boolean) => mockResolveIncomingPath(path, initial),
}));

import { redirectSystemPath } from '../../app/+native-intent';

describe('redirectSystemPath', () => {
  beforeEach(() => {
    mockResolveIncomingPath.mockReset();
    mockResolveIncomingPath.mockReturnValue('/');
  });

  it('delegates incoming paths to the pure resolver', () => {
    expect(redirectSystemPath({ path: 'dfxwallet://buy', initial: true })).toBe('/');
    expect(mockResolveIncomingPath).toHaveBeenCalledWith('dfxwallet://buy', true);
  });

  it('falls back to the root when incoming-path processing throws', () => {
    mockResolveIncomingPath.mockImplementationOnce(() => {
      throw new Error('malformed native intent');
    });

    expect(redirectSystemPath({ path: 'broken', initial: false })).toBe('/');
  });
});
