import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import i18next from 'i18next';
import { DfxColors, Typography } from '@/theme';

type Props = { children: ReactNode };
type State = { hasError: boolean; error: Error | null };

function translate(key: string) {
  // eslint-disable-next-line import/no-named-as-default-member -- non-React code must use the initialized default i18next instance
  return i18next.t(key);
}

export class ErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  override componentDidCatch(_error: Error, _info: ErrorInfo) {
    // TODO: Report to crash analytics
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  override render() {
    if (this.state.hasError) {
      return (
        <View style={styles.container}>
          <Text style={styles.title}>{translate('errorBoundary.title')}</Text>
          <Text style={styles.message}>{translate('errorBoundary.message')}</Text>
          <Pressable style={styles.button} onPress={this.handleReset}>
            <Text style={styles.buttonText}>{translate('common.retry')}</Text>
          </Pressable>
        </View>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DfxColors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 16,
  },
  title: {
    ...Typography.headlineMedium,
    color: DfxColors.text,
  },
  message: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    textAlign: 'center',
  },
  button: {
    backgroundColor: DfxColors.primary,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 16,
  },
  buttonText: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.white,
  },
});
