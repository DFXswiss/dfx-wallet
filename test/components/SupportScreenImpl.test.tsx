import React from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { render, waitFor } from '@testing-library/react-native';
import { lightColors } from '@/theme';
import type { SupportIssueDto } from '@/features/dfx-backend/services';

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string | string[], params?: Record<string, unknown>) => {
      const resolved = Array.isArray(key) ? key[0]! : key;
      return params ? `${resolved}:${JSON.stringify(params)}` : resolved;
    },
  }),
}));

jest.mock('expo-router', () => ({
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn(), canGoBack: () => true }),
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success', Error: 'error' },
}));

const mockGetIssues = jest.fn();
jest.mock('@/features/dfx-backend/services', () => ({
  dfxSupportService: {
    getIssues: (...args: unknown[]) => mockGetIssues(...args),
    createIssue: jest.fn(),
    sendMessage: jest.fn(),
  },
}));

jest.mock('@/components', () => {
  const ReactActual = jest.requireActual('react');
  const { View } = jest.requireActual('react-native');
  return {
    EmptyState: () => null,
    PrimaryButton: () => null,
    ScreenContainer: ({ children }: { children?: React.ReactNode }) =>
      ReactActual.createElement(View, null, children),
    Skeleton: () => null,
  };
});

// eslint-disable-next-line import/first
import SupportScreen from '../../src/features/dfx-backend/screens/SupportScreenImpl';

function issue(overrides: Partial<SupportIssueDto> & Pick<SupportIssueDto, 'id' | 'state'>): SupportIssueDto {
  return {
    uid: `I-${overrides.id}`,
    type: 'GenericIssue',
    reason: 'Other',
    createdDate: '2025-05-01T10:00:00.000Z',
    messages: [],
    ...overrides,
  };
}

function badgeBackground(
  getByTestId: (id: string) => { props: { style?: StyleProp<ViewStyle> } },
  id: number,
): string | undefined {
  const style = getByTestId(`support-ticket-status-${id}`).props.style;
  return StyleSheet.flatten(style).backgroundColor as string | undefined;
}

beforeEach(() => {
  mockGetIssues.mockReset();
});

describe('SupportScreenImpl status colours', () => {
  it('maps Open / InProgress / Resolved / Closed onto the theme tokens', async () => {
    mockGetIssues.mockResolvedValueOnce([
      issue({ id: 1, state: 'Open' }),
      issue({ id: 2, state: 'InProgress' }),
      issue({ id: 3, state: 'Resolved' }),
      issue({ id: 4, state: 'Closed' }),
    ]);

    const { getByTestId } = render(<SupportScreen />);

    await waitFor(() => {
      expect(getByTestId('support-ticket-status-1')).toBeTruthy();
    });

    expect(badgeBackground(getByTestId, 1)).toBe(lightColors.warning);
    expect(badgeBackground(getByTestId, 2)).toBe(lightColors.info);
    expect(badgeBackground(getByTestId, 3)).toBe(lightColors.success);
    expect(badgeBackground(getByTestId, 4)).toBe(lightColors.textTertiary);
  });

  it('falls back to textTertiary for a state outside the four mapped values', async () => {
    mockGetIssues.mockResolvedValueOnce([issue({ id: 9, state: 'Pending' })]);

    const { getByTestId } = render(<SupportScreen />);

    await waitFor(() => {
      expect(getByTestId('support-ticket-status-9')).toBeTruthy();
    });

    expect(badgeBackground(getByTestId, 9)).toBe(lightColors.textTertiary);
  });
});
