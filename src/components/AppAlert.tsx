import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { DfxColors, Typography } from '@/theme';

/**
 * Drop-in replacement for React Native's native `Alert.alert` that
 * renders inside the app's design language (DfxColors + Typography +
 * the same rounded surface as ConfirmTargetWalletModal). Native alerts
 * stood out as a dark iOS sheet against the otherwise-light DFX
 * surface and broke the visual continuity of the app.
 *
 * API mirrors the native one as closely as possible so the migration
 * from `Alert.alert(title, message, buttons)` is mostly mechanical:
 *
 *   const { show } = useAppAlert();
 *   show({
 *     title: 'Delete wallet?',
 *     message: 'This cannot be undone.',
 *     buttons: [
 *       { text: 'Cancel', style: 'cancel' },
 *       { text: 'Delete', style: 'destructive', onPress: () => doDelete() },
 *     ],
 *   });
 *
 * Single-button alerts default to `[{ text: 'OK' }]`. The dismiss
 * gesture (Android back, modal-overlay-tap) fires the cancel button's
 * `onPress` if present, otherwise just closes.
 */

export type AppAlertButtonStyle = 'default' | 'cancel' | 'destructive';

export type AppAlertButton = {
  text: string;
  style?: AppAlertButtonStyle;
  onPress?: () => void | Promise<void>;
};

export type AppAlertOptions = {
  title: string;
  message?: string;
  buttons?: AppAlertButton[];
};

type ShowFn = (options: AppAlertOptions) => void;

const AlertContext = createContext<ShowFn | null>(null);

/**
 * Mount once at the app root. Every descendant can then read `show`
 * from {@link useAppAlert} to trigger an alert from anywhere — no
 * per-screen state plumbing.
 */
export function AppAlertProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppAlertOptions | null>(null);

  const show = useCallback<ShowFn>((opts) => {
    setState(opts);
  }, []);

  const dismiss = useCallback(() => setState(null), []);

  const handlePress = useCallback((button: AppAlertButton) => {
    // Close the modal first so a `setState` inside the button's
    // handler doesn't race with our own dismiss — the native Alert
    // closes synchronously before firing the handler, mirror that.
    setState(null);
    if (button.onPress) {
      const result = button.onPress();
      if (result instanceof Promise) {
        // Swallow rejection — alert handlers traditionally do not
        // need to be awaitable; the caller can wrap if it wants to.
        void result.catch(() => undefined);
      }
    }
  }, []);

  const handleRequestClose = useCallback(() => {
    if (!state) return;
    // If a cancel button exists, fire its handler on dismiss — same
    // contract as the iOS Alert (swipe-away triggers cancel).
    const cancel = state.buttons?.find((b) => b.style === 'cancel');
    if (cancel) {
      handlePress(cancel);
    } else {
      dismiss();
    }
  }, [state, handlePress, dismiss]);

  const buttons: AppAlertButton[] = state?.buttons?.length
    ? state.buttons
    : [{ text: 'OK', style: 'default' }];

  return (
    <AlertContext.Provider value={show}>
      {children}
      <Modal
        visible={state !== null}
        animationType="fade"
        transparent
        onRequestClose={handleRequestClose}
      >
        <View style={styles.overlay}>
          <Pressable style={styles.scrim} onPress={handleRequestClose} />
          <View style={styles.card}>
            {state ? (
              <>
                <Text style={styles.title}>{state.title}</Text>
                {state.message ? <Text style={styles.body}>{state.message}</Text> : null}
                <View style={[styles.actions, buttons.length === 1 && styles.actionsSingle]}>
                  {buttons.map((btn, i) => {
                    const isDestructive = btn.style === 'destructive';
                    const isCancel = btn.style === 'cancel';
                    return (
                      <Pressable
                        key={`${btn.text}-${i}`}
                        style={({ pressed }) => [
                          styles.button,
                          isCancel ? styles.buttonGhost : styles.buttonPrimary,
                          isDestructive && styles.buttonDestructive,
                          pressed && styles.pressed,
                        ]}
                        onPress={() => handlePress(btn)}
                        testID={`app-alert-button-${i}`}
                      >
                        <Text
                          style={[
                            styles.buttonLabel,
                            isCancel ? styles.buttonGhostLabel : styles.buttonPrimaryLabel,
                            isDestructive && styles.buttonDestructiveLabel,
                          ]}
                        >
                          {btn.text}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            ) : null}
          </View>
        </View>
      </Modal>
    </AlertContext.Provider>
  );
}

export function useAppAlert(): { show: ShowFn } {
  const show = useContext(AlertContext);
  if (!show) {
    throw new Error('useAppAlert must be used inside <AppAlertProvider>');
  }
  return { show };
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
  },
  scrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(11, 20, 38, 0.45)',
  },
  card: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: DfxColors.surface,
    borderRadius: 20,
    padding: 22,
    gap: 12,
  },
  title: {
    ...Typography.headlineSmall,
    color: DfxColors.text,
  },
  body: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 4,
  },
  actionsSingle: {
    // Single-button alerts stretch full-width so the tap target is
    // huge — mirrors the native Alert's "OK" treatment.
    flexDirection: 'column',
  },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonGhost: {
    backgroundColor: DfxColors.background,
    borderWidth: 1,
    borderColor: DfxColors.border,
  },
  buttonPrimary: {
    backgroundColor: DfxColors.primary,
  },
  buttonDestructive: {
    backgroundColor: DfxColors.error,
  },
  buttonLabel: {
    ...Typography.bodyMedium,
    fontWeight: '700',
  },
  buttonGhostLabel: {
    color: DfxColors.textSecondary,
  },
  buttonPrimaryLabel: {
    color: DfxColors.white,
  },
  buttonDestructiveLabel: {
    color: DfxColors.white,
  },
  pressed: {
    opacity: 0.7,
  },
});
