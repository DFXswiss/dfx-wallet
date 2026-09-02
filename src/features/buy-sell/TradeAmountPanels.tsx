import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon } from '@/components/Icon';
import { useColors, type ThemeColors } from '@/theme';
import { SELECTOR_PILL_LAYOUT, TRADE_PANEL_GEOMETRY } from './tradePanelStyles';

type TradeAmountPanelsProps = {
  payLabel: ReactNode;
  payAmount: ReactNode;
  paySelector: ReactNode;
  receiveLabel: ReactNode;
  receiveAmount: ReactNode;
  receiveSelector: ReactNode;
  testID: string;
  flipTestID: string;
  flipAccessibilityLabel: string;
  onFlip?: () => void;
};

export function TradeAmountPanels({
  payLabel,
  payAmount,
  paySelector,
  receiveLabel,
  receiveAmount,
  receiveSelector,
  testID,
  flipTestID,
  flipAccessibilityLabel,
  onFlip,
}: TradeAmountPanelsProps) {
  const colors = useColors();
  const styles = makeStyles(colors);

  return (
    <View style={styles.panels} testID={testID}>
      <View style={styles.panel}>
        {payLabel}
        <View style={styles.pinput}>
          {payAmount}
          {paySelector}
        </View>
      </View>
      <Pressable
        style={styles.flipButton}
        onPress={onFlip}
        disabled={!onFlip}
        testID={flipTestID}
        accessibilityRole="button"
        accessibilityLabel={flipAccessibilityLabel}
      >
        <Icon name="swap" size={18} color={colors.primary} />
      </Pressable>
      <View style={[styles.panel, styles.receivePanel]}>
        {receiveLabel}
        <View style={styles.pinput}>
          {receiveAmount}
          {receiveSelector}
        </View>
      </View>
    </View>
  );
}

type TradeSelectorPillProps = {
  children: ReactNode;
  testID: string;
  onPress?: () => void;
  disabled?: boolean;
  accessibilityLabel?: string;
};

export function TradeSelectorPill({
  children,
  testID,
  onPress,
  disabled = false,
  accessibilityLabel,
}: TradeSelectorPillProps) {
  const colors = useColors();
  const styles = makeStyles(colors);
  return (
    <Pressable
      style={styles.pill}
      onPress={onPress}
      disabled={disabled || !onPress}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
    >
      {children}
      <Icon name="chevron-right" size={16} color={colors.textTertiary} />
    </Pressable>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    panels: {
      position: 'relative',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: TRADE_PANEL_GEOMETRY.panelRadius,
      backgroundColor: colors.card,
      overflow: 'hidden',
    },
    panel: {
      paddingVertical: TRADE_PANEL_GEOMETRY.panelPaddingVertical,
      paddingHorizontal: TRADE_PANEL_GEOMETRY.panelPaddingHorizontal,
    },
    receivePanel: {
      backgroundColor: colors.surfaceLight,
      borderTopWidth: TRADE_PANEL_GEOMETRY.dividerWidth,
      borderTopColor: colors.divider,
    },
    pinput: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: TRADE_PANEL_GEOMETRY.inputGap,
      marginTop: TRADE_PANEL_GEOMETRY.inputMarginTop,
    },
    flipButton: {
      alignSelf: 'center',
      width: TRADE_PANEL_GEOMETRY.flipSize,
      height: TRADE_PANEL_GEOMETRY.flipSize,
      borderRadius: TRADE_PANEL_GEOMETRY.flipRadius,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      marginTop: -20,
      marginBottom: -20,
      zIndex: 2,
    },
    pill: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      borderWidth: 1,
      borderColor: colors.border,
      backgroundColor: colors.surfaceLight,
      borderRadius: 999,
      paddingVertical: 8,
      paddingHorizontal: 14,
      ...SELECTOR_PILL_LAYOUT,
    },
  });
