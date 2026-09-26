import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useAccount } from '@tetherto/wdk-react-native-core';
import {
  AppHeader,
  GlassCard,
  GlassPill,
  Icon,
  PrimaryButton,
  QrCode,
  ScreenBackdrop,
} from '@/components';
import type { ChainId } from '@/config/chains';
import { FEATURES } from '@/config/features';
import { useLdsWallet } from '@/hooks';
import { Layout, Typography, useColors, type ThemeColors } from '@/theme';

type ReceiveStep = 'asset' | 'qr';

type AssetOption = {
  symbol: string;
  label: string;
  chains: { chain: ChainId; label: string }[];
};

/**
 * Bitcoin offers three receive layers — Native on-chain, Lightning, and EVM
 * (wrapped). Stablecoins only ship over EVM; rather than asking the user to
 * pick between identical EVM chains, we default to Ethereum and skip the chain
 * selector entirely. The Taproot/Lightning option resolves a DFX-managed
 * Lightning address via the LDS service, so it is hidden when
 * `FEATURES.DFX_BACKEND` is off — without it the QR would be blank.
 *
 * Computed at render time so a test can flip `FEATURES.DFX_BACKEND` between
 * mounts and exercise both layer combinations.
 */
const buildReceiveAssets = (): AssetOption[] => [
  {
    symbol: 'BTC',
    label: 'Bitcoin',
    chains: [
      { chain: 'bitcoin', label: 'SegWit' },
      ...(FEATURES.DFX_BACKEND
        ? ([
            { chain: 'bitcoin-taproot', label: 'Taproot' },
            { chain: 'spark', label: 'Lightning' },
          ] as const)
        : []),
      { chain: 'ethereum', label: 'EVM' },
    ],
  },
  { symbol: 'CHF', label: 'CHF', chains: [{ chain: 'ethereum', label: 'Ethereum' }] },
  { symbol: 'EUR', label: 'Euro', chains: [{ chain: 'ethereum', label: 'Ethereum' }] },
  { symbol: 'USD', label: 'Dollar', chains: [{ chain: 'ethereum', label: 'Ethereum' }] },
];

export default function ReceiveScreen() {
  const router = useRouter();
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const receiveAssets = useMemo(buildReceiveAssets, []);
  const [step, setStep] = useState<ReceiveStep>('asset');
  // Start unselected so no card has a border on first render — the active
  // border appears only after the user explicitly picks an asset.
  const [selectedAsset, setSelectedAsset] = useState<AssetOption | null>(null);
  const [selectedChain, setSelectedChain] = useState<ChainId>('ethereum');
  const [copied, setCopied] = useState(false);

  // Taproot in this app is the DFX Lightning Address (lightning.space-managed
  // custodial wallet, Taproot Asset channels under the hood). For every other
  // chain we use the local WDK-derived address.
  const { address: derivedAddress } = useAccount({ network: selectedChain, accountIndex: 0 });
  const lds = useLdsWallet();
  const address =
    selectedChain === 'bitcoin-taproot'
      ? (lds.user?.lightning.address ?? '')
      : (derivedAddress ?? '');

  const handleAssetSelect = (asset: AssetOption) => {
    setSelectedAsset(asset);
    setSelectedChain(asset.chains[0]!.chain);
    setStep('qr');
  };

  const handleCopy = async () => {
    // The Copy button is gated on `address` via its `disabled` prop, so by
    // the time we land here the string is guaranteed to be non-empty.
    await Clipboard.setStringAsync(address);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderAssetStep = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepSubtitle}>{t('receive.selectAsset')}</Text>
      <View style={styles.assetList} testID="receive-asset-list">
        {receiveAssets.map((asset) => {
          const active = selectedAsset?.symbol === asset.symbol;
          return (
            <GlassCard
              key={asset.symbol}
              testID={`receive-asset-${asset.symbol.toLowerCase()}`}
              variant={active ? 'lead' : 'default'}
              tone={active ? 'accent' : 'default'}
              padding={18}
              contentStyle={styles.assetCard}
              onPress={() => handleAssetSelect(asset)}
            >
              <Text style={[styles.assetSymbol, active && styles.assetSymbolActive]}>
                {asset.symbol}
              </Text>
              <Text style={styles.assetLabel}>{asset.label}</Text>
            </GlassCard>
          );
        })}
      </View>

      {FEATURES.BUY_SELL && (
        <GlassCard
          padding={16}
          tone="accent"
          contentStyle={styles.destinationCard}
          onPress={() => router.push('/(auth)/buy')}
          testID="receive-destination-bank"
          accessibilityRole="button"
          accessibilityLabel={t('receive.buyFromBank')}
        >
          <View style={styles.destinationIcon}>
            <Icon name="document" size={20} color={colors.primary} strokeWidth={2.2} />
          </View>
          <View style={styles.destinationText}>
            <Text style={styles.destinationTitle}>{t('receive.buyFromBank')}</Text>
            <Text style={styles.destinationSubtitle}>{t('receive.buyFromBankSubtitle')}</Text>
          </View>
          <Icon name="chevron-right" size={18} color={colors.textTertiary} />
        </GlassCard>
      )}
    </View>
  );

  const renderQrStep = (asset: AssetOption) => {
    return (
      <View style={styles.stepContent}>
        <GlassPill selected testID="receive-selected-asset-pill" onPress={() => setStep('asset')}>
          <View style={styles.selectedAssetContent}>
            <Text style={styles.selectedAssetText}>{asset.symbol}</Text>
            <Icon name="chevron-right" size={14} color={colors.textTertiary} />
          </View>
        </GlassPill>

        {asset.chains.length > 1 && (
          <ScrollView
            testID="receive-chain-bar"
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chainBar}
          >
            {asset.chains.map((c) => (
              <GlassPill
                key={c.chain}
                testID={`receive-chain-${c.chain}`}
                selected={selectedChain === c.chain}
                style={styles.chainChip}
                onPress={() => setSelectedChain(c.chain)}
              >
                <Text
                  style={[
                    styles.chainChipText,
                    selectedChain === c.chain && styles.chainChipTextActive,
                  ]}
                >
                  {c.label}
                </Text>
              </GlassPill>
            ))}
          </ScrollView>
        )}

        <View style={styles.qrContainer} testID="receive-qr">
          {address ? (
            <QrCode value={address} size={200} />
          ) : (
            <GlassCard variant="quiet" style={styles.qrPlaceholder}>
              <Text style={styles.qrPlaceholderText}>{t('receive.noAddress')}</Text>
            </GlassCard>
          )}
        </View>

        <GlassCard padding={20} style={styles.addressContainer}>
          <Text style={styles.addressLabel}>
            {t('receive.yourAddress', { chain: selectedChain })}
          </Text>
          <Text testID="receive-address" style={styles.address} selectable numberOfLines={2}>
            {address || t('receive.walletNotInitialized')}
          </Text>
        </GlassCard>

        <PrimaryButton
          testID="receive-copy-button"
          title={copied ? t('common.copied') : t('common.copy')}
          onPress={handleCopy}
          disabled={!address}
        />
      </View>
    );
  };

  const body = (
    <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
      <AppHeader
        title={t('receive.title')}
        onBack={() => {
          if (step === 'qr') setStep('asset');
          else router.back();
        }}
        testID="receive-screen"
      />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {step === 'asset' && renderAssetStep()}
        {step === 'qr' && selectedAsset && renderQrStep(selectedAsset)}
      </ScrollView>
    </SafeAreaView>
  );

  return (
    <>
      <Stack.Screen options={{ headerShown: false, gestureEnabled: true }} />
      <View style={styles.bg}>
        <ScreenBackdrop />
        {body}
      </View>
    </>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    bg: {
      flex: 1,
      backgroundColor: colors.background,
    },
    safeArea: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: 20,
      paddingBottom: 32,
      gap: 18,
    },
    stepContent: {
      gap: 18,
    },
    stepSubtitle: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
      fontWeight: '500',
      marginBottom: 4,
    },
    assetList: {
      gap: Layout.listGap,
    },
    assetCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    assetSymbol: {
      ...Typography.headlineSmall,
      color: colors.text,
      fontWeight: '700',
      width: 56,
    },
    assetSymbolActive: {
      color: colors.primary,
    },
    assetLabel: {
      ...Typography.bodyLarge,
      color: colors.textSecondary,
    },
    selectedAssetContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    selectedAssetText: {
      ...Typography.bodyMedium,
      color: colors.primary,
      fontWeight: '700',
    },
    chainBar: {
      flexGrow: 0,
    },
    chainChip: {
      marginRight: 8,
    },
    chainChipText: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
      fontWeight: '500',
    },
    chainChipTextActive: {
      color: colors.primary,
      fontWeight: '600',
    },
    qrContainer: {
      alignItems: 'center',
      paddingVertical: 8,
    },
    qrPlaceholder: {
      width: 200,
      height: 200,
      alignItems: 'center',
      justifyContent: 'center',
    },
    qrPlaceholderText: {
      ...Typography.bodyMedium,
      color: colors.textTertiary,
    },
    addressContainer: {
      gap: 8,
      alignItems: 'center',
    },
    addressLabel: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      textTransform: 'uppercase',
      letterSpacing: 1,
    },
    address: {
      ...Typography.bodyMedium,
      color: colors.text,
      textAlign: 'center',
      fontFamily: 'monospace',
    },
    destinationCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    destinationIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    destinationText: {
      flex: 1,
      gap: 2,
    },
    destinationTitle: {
      ...Typography.bodyLarge,
      color: colors.text,
      fontWeight: '600',
    },
    destinationSubtitle: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
  });
