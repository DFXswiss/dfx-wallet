import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GlassCard } from '@/components/GlassCard';
import { Icon } from '@/components';
import { useColors } from '@/theme';
import { makeTradeSharedStyles } from './tradeSharedStyles';

type Props = {
  testID: string;
  addressShort: string;
};

/**
 * Shown on the amount step of Buy/Sell when the screen was opened for a
 * specific linked wallet (`targetAddress`/`targetBlockchain`). Identical
 * markup and copy in both flows before this module — only the testID and
 * bank/deposit onConfirm wiring ever differed.
 */
export function TargetWalletBanner({ testID, addressShort }: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeTradeSharedStyles(colors), [colors]);

  return (
    <GlassCard testID={testID} tone="accent" radius={12} padding={0} style={styles.targetBanner}>
      <View style={styles.targetIcon}>
        <Icon name="wallet" size={18} color={colors.primary} />
      </View>
      <View style={styles.targetBody}>
        <Text style={styles.targetLabel}>{t('linkedWallet.banner.label')}</Text>
        <Text style={styles.targetAddress} numberOfLines={1}>
          {addressShort}
        </Text>
      </View>
    </GlassCard>
  );
}
