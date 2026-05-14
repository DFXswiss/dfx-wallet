import { Text, View } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { AppAlertProvider, useAppAlert } from '../../src/components/AppAlert';

function Trigger({
  onShow,
  buttons,
}: {
  onShow: () => void;
  buttons?: { text: string; style?: 'default' | 'cancel' | 'destructive'; onPress?: () => void }[];
}) {
  const { show } = useAppAlert();
  const fire = () => {
    show({
      title: 'Delete wallet?',
      message: 'Cannot be undone.',
      ...(buttons ? { buttons } : {}),
    });
    onShow();
  };
  return (
    <View>
      <Text onPress={fire}>open</Text>
    </View>
  );
}

describe('AppAlert', () => {
  it('renders the title and message when show() is called', () => {
    const { getByText } = render(
      <AppAlertProvider>
        <Trigger onShow={() => {}} />
      </AppAlertProvider>,
    );
    fireEvent.press(getByText('open'));
    expect(getByText('Delete wallet?')).toBeTruthy();
    expect(getByText('Cannot be undone.')).toBeTruthy();
  });

  it('defaults to a single OK button when no buttons are provided', () => {
    const { getByText, queryByText } = render(
      <AppAlertProvider>
        <Trigger onShow={() => {}} />
      </AppAlertProvider>,
    );
    fireEvent.press(getByText('open'));
    expect(getByText('OK')).toBeTruthy();
    // tapping the default button dismisses
    fireEvent.press(getByText('OK'));
    expect(queryByText('Delete wallet?')).toBeNull();
  });

  it('fires the button onPress handler and dismisses', () => {
    const onPress = jest.fn();
    const { getByText, queryByText } = render(
      <AppAlertProvider>
        <Trigger
          onShow={() => {}}
          buttons={[
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress },
          ]}
        />
      </AppAlertProvider>,
    );
    fireEvent.press(getByText('open'));
    act(() => {
      fireEvent.press(getByText('Delete'));
    });
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(queryByText('Delete wallet?')).toBeNull();
  });
});
