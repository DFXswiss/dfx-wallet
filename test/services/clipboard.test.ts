import * as Clipboard from 'expo-clipboard';
import { copySensitive } from '@/services/clipboard';

jest.mock('expo-clipboard', () => ({
  getStringAsync: jest.fn(),
  setStringAsync: jest.fn(),
}));

describe('copySensitive', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    (Clipboard.getStringAsync as jest.Mock).mockReset();
    (Clipboard.setStringAsync as jest.Mock).mockReset();
    (Clipboard.setStringAsync as jest.Mock).mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('copies and clears the same sensitive value after the default timeout', async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue('secret seed');

    await copySensitive('secret seed');
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('secret seed');

    await jest.advanceTimersByTimeAsync(60_000);
    expect(Clipboard.getStringAsync).toHaveBeenCalledTimes(1);
    expect(Clipboard.setStringAsync).toHaveBeenLastCalledWith('');
  });

  it('preserves clipboard content that changed before the custom timeout', async () => {
    (Clipboard.getStringAsync as jest.Mock).mockResolvedValue('new content');

    await copySensitive('secret seed', 500);
    await jest.advanceTimersByTimeAsync(500);

    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
    expect(Clipboard.setStringAsync).toHaveBeenCalledWith('secret seed');
  });

  it('silently handles clipboard read failures during cleanup', async () => {
    (Clipboard.getStringAsync as jest.Mock).mockRejectedValue(new Error('permission denied'));

    await copySensitive('secret seed', 1);
    await jest.advanceTimersByTimeAsync(1);

    expect(Clipboard.setStringAsync).toHaveBeenCalledTimes(1);
  });
});
