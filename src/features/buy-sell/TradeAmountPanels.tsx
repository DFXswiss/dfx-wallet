import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { GlassCard } from '@/components/GlassCard';
import { GlassIconButton } from '@/components/GlassIconButton';
import { GlassPill } from '@/components/GlassPill';
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

// no-op fallback so `GlassIconButton`'s required `onPress` stays satisfied
// while the flip button is disabled (no `onFlip` supplied).
const noopFlip = () => undefined;

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
    <GlassCard
      testID={testID}
      radius={TRADE_PANEL_GEOMETRY.panelRadius}
      padding={0}
      style={styles.panels}
    >
      <View testID={`${testID}-pay-row`} style={styles.panel}>
        <View testID={`${testID}-pay-column`} style={styles.column}>
          {payLabel}
          <View style={styles.amountLine}>{payAmount}</View>
        </View>
        {paySelector}
      </View>
      <GlassIconButton
        icon={<Icon name="swap" size={18} color={colors.primary} />}
        onPress={onFlip ?? noopFlip}
        disabled={!onFlip}
        size={TRADE_PANEL_GEOMETRY.flipSize}
        style={styles.flipButton}
        testID={flipTestID}
        accessibilityLabel={flipAccessibilityLabel}
      />
      <View testID={`${testID}-receive-row`} style={[styles.panel, styles.receivePanel]}>
        <View testID={`${testID}-receive-column`} style={styles.column}>
          {receiveLabel}
          <View style={styles.amountLine}>{receiveAmount}</View>
        </View>
        {receiveSelector}
      </View>
    </GlassCard>
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
    <GlassPill
      {...(onPress ? { onPress } : {})}
      disabled={disabled}
      shape="rounded"
      style={styles.pillOuter}
      contentStyle={styles.pillContent}
      testID={testID}
      accessibilityRole="button"
      {...(accessibilityLabel ? { accessibilityLabel } : {})}
    >
      <>
        {children}
        <Icon name="chevron-right" size={16} color={colors.textTertiary} />
      </>
    </GlassPill>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    panels: {
      overflow: 'hidden',
    },
    panel: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: TRADE_PANEL_GEOMETRY.inputGap,
      paddingVertical: TRADE_PANEL_GEOMETRY.panelPaddingVertical,
      paddingHorizontal: TRADE_PANEL_GEOMETRY.panelPaddingHorizontal,
    },
    receivePanel: {
      borderTopWidth: TRADE_PANEL_GEOMETRY.dividerWidth,
      borderTopColor: colors.divider,
    },
    column: {
      flex: 1,
      flexDirection: 'column',
      minWidth: 0,
    },
    amountLine: {
      flexDirection: 'row',
      marginTop: TRADE_PANEL_GEOMETRY.inputMarginTop,
      minWidth: 0,
    },
    flipButton: {
      alignSelf: 'center',
      marginTop: -(TRADE_PANEL_GEOMETRY.flipSize / 2),
      marginBottom: -(TRADE_PANEL_GEOMETRY.flipSize / 2),
      zIndex: 2,
    },
    pillOuter: {
      ...SELECTOR_PILL_LAYOUT,
      alignSelf: 'center',
    },
    pillContent: {
      gap: 10,
      paddingVertical: 8,
      paddingHorizontal: 14,
    },
  });
