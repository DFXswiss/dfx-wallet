import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { Radius, useColors } from '@/theme';

type Position = 'center' | 'bottom' | 'side';

type Props = {
  visible: boolean;
  onRequestClose: () => void;
  /** @default 'center' */
  position?: Position;
  testID?: string;
  children?: ReactNode;
};

function backdropAlignFor(position: Position): ViewStyle {
  switch (position) {
    case 'bottom':
      return { alignItems: 'stretch', justifyContent: 'flex-end' };
    case 'side':
      return { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'flex-end' };
    case 'center':
      return { alignItems: 'center', justifyContent: 'center' };
  }
}

function bodyBoxFor(position: Position): ViewStyle {
  switch (position) {
    case 'bottom':
      return { width: '100%' };
    case 'side':
      return { height: '100%', width: '78%' };
    case 'center':
      return { width: '100%', maxWidth: 380, paddingHorizontal: 24 };
  }
}

function bodyRadiusFor(position: Position): number {
  return position === 'center' ? Radius.lg : Radius.xl;
}

/**
 * Modal shell: a `scrimStrong` backdrop plus a glass body, positioned
 * `center` (dialogs), `bottom` (action sheets) or `side` (drawers). Tapping
 * the backdrop calls `onRequestClose`; tapping the body does not.
 */
export function GlassSheet({
  visible,
  onRequestClose,
  position = 'center',
  testID,
  children,
}: Props) {
  const colors = useColors();
  // Every other modal-shaped component in this repo (ConfirmTargetWalletModal,
  // RenameWalletModal, MenuModal) exposes a testID on each of its Pressables —
  // GlassSheet didn't, which left its backdrop/body untestable except via a
  // fragile UNSAFE_getAllByType(Pressable) type-search. Derived from the
  // caller's own `testID` so two GlassSheets on one screen don't collide.
  const backdropTestID = testID ? `${testID}-backdrop` : undefined;
  const bodyTestID = testID ? `${testID}-body` : undefined;

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onRequestClose}
      {...(testID ? { testID } : {})}
    >
      <Pressable
        style={[
          styles.backdrop,
          { backgroundColor: colors.scrimStrong },
          backdropAlignFor(position),
        ]}
        onPress={onRequestClose}
        accessibilityRole="button"
        accessibilityLabel="Close"
        {...(backdropTestID ? { testID: backdropTestID } : {})}
      >
        <Pressable
          onPress={(event) => event.stopPropagation()}
          style={bodyBoxFor(position)}
          accessibilityViewIsModal
          {...(bodyTestID ? { testID: bodyTestID } : {})}
        >
          <GlassSurface variant="default" radius={bodyRadiusFor(position)} style={styles.body}>
            {children}
          </GlassSurface>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
  },
  body: {
    padding: 22,
  },
});
