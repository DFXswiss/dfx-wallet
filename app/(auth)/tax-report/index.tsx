import { useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Directory, File, Paths } from 'expo-file-system';
import { AppHeader, PrimaryButton, ScreenContainer } from '@/components';
import { dfxTransactionService, type TaxReportType } from '@/services/dfx';
import { DfxColors, Typography } from '@/theme';

/**
 * Soft-import for expo-sharing — the native module is only present after a
 * fresh `expo prebuild`. Without this guard the static import crashes the
 * whole tax-report screen with "Cannot find native module 'ExpoSharing'".
 * Once iOS is rebuilt the require succeeds and the share-sheet works.
 */
type SharingApi = {
  isAvailableAsync: () => Promise<boolean>;
  shareAsync: (uri: string, options?: { mimeType?: string; dialogTitle?: string }) => Promise<void>;
};
let sharingModule: SharingApi | null = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  sharingModule = require('expo-sharing') as SharingApi;
} catch {
  sharingModule = null;
}

const REPORT_TYPES: { kind: TaxReportType; titleKey: string; bodyKey: string }[] = [
  {
    kind: 'CoinTracking',
    titleKey: 'taxReport.types.coinTracking.title',
    bodyKey: 'taxReport.types.coinTracking.body',
  },
  {
    kind: 'ChainReport',
    titleKey: 'taxReport.types.chainReport.title',
    bodyKey: 'taxReport.types.chainReport.body',
  },
  {
    kind: 'Compact',
    titleKey: 'taxReport.types.compact.title',
    bodyKey: 'taxReport.types.compact.body',
  },
];

/**
 * Native tax-report screen. Mirrors realunit-app's `settings_tax_report_page.dart`
 * pattern: pick a year, pick a report format, server generates a CSV via
 * DFX' two-step `/v1/transaction/csv` flow (PUT returns a single-use file
 * key, GET streams the CSV), download via expo-file-system, hand to the
 * native share-sheet via expo-sharing.
 *
 * Replaces the previous "open FAQ webview" stub which had nothing to do
 * with downloading an actual tax export.
 */
export default function TaxReportScreen() {
  const { t } = useTranslation();
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState<number>(currentYear);
  const [reportType, setReportType] = useState<TaxReportType>('CoinTracking');
  const [busy, setBusy] = useState(false);

  const yearOptions = [currentYear, currentYear - 1, currentYear - 2];

  const handleDownload = async () => {
    setBusy(true);
    try {
      const from = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0));
      const to = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0));
      const { downloadUrl } = await dfxTransactionService.createCsvExport({
        from,
        to,
        type: reportType,
      });

      const dest = new Directory(Paths.cache);
      const downloaded = await File.downloadFileAsync(downloadUrl, dest);
      const finalUri = downloaded.uri;

      const sharingAvailable = sharingModule ? await sharingModule.isAvailableAsync() : false;
      if (sharingAvailable && sharingModule) {
        await sharingModule.shareAsync(finalUri, {
          mimeType: 'text/csv',
          dialogTitle: t('taxReport.shareTitle'),
        });
      } else {
        Alert.alert(t('taxReport.title'), t('taxReport.savedAt', { uri: finalUri }));
      }
    } catch (err) {
      Alert.alert(
        t('taxReport.title'),
        err instanceof Error ? err.message : t('taxReport.downloadFailed'),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScreenContainer scrollable>
      <AppHeader title={t('settings.taxReport')} testID="tax-report" />
      <View style={styles.content}>
        <Text style={styles.intro}>{t('taxReport.intro')}</Text>

        <Text style={styles.sectionLabel}>{t('taxReport.yearLabel')}</Text>
        <View style={styles.row}>
          {yearOptions.map((y) => {
            const active = y === year;
            return (
              <Pressable
                key={y}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setYear(y)}
                testID={`tax-report-year-${y}`}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{y}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.sectionLabel}>{t('taxReport.formatLabel')}</Text>
        <View style={styles.formatList}>
          {REPORT_TYPES.map((entry) => {
            const active = entry.kind === reportType;
            return (
              <Pressable
                key={entry.kind}
                style={[styles.formatRow, active && styles.formatRowActive]}
                onPress={() => setReportType(entry.kind)}
                testID={`tax-report-type-${entry.kind}`}
              >
                <View style={[styles.radio, active && styles.radioActive]}>
                  {active ? <View style={styles.radioDot} /> : null}
                </View>
                <View style={styles.formatBody}>
                  <Text style={styles.formatTitle}>{t(entry.titleKey)}</Text>
                  <Text style={styles.formatDesc}>{t(entry.bodyKey)}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <PrimaryButton
          title={t('taxReport.cta')}
          onPress={handleDownload}
          loading={busy}
          testID="tax-report-download"
        />

        {busy ? (
          <View style={styles.progress}>
            <ActivityIndicator color={DfxColors.primary} />
            <Text style={styles.progressText}>{t('taxReport.generating')}</Text>
          </View>
        ) : null}
      </View>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingTop: 12,
    paddingBottom: 32,
    gap: 16,
  },
  intro: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    lineHeight: 20,
  },
  sectionLabel: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    fontWeight: '600',
  },
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  chip: {
    flex: 1,
    backgroundColor: DfxColors.surface,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  chipActive: {
    borderColor: DfxColors.primary,
    backgroundColor: DfxColors.primaryLight,
  },
  chipText: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    fontWeight: '600',
  },
  chipTextActive: {
    color: DfxColors.primary,
  },
  formatList: {
    backgroundColor: DfxColors.surface,
    borderRadius: 16,
    overflow: 'hidden',
  },
  formatRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 14,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: DfxColors.border,
  },
  formatRowActive: {
    backgroundColor: DfxColors.primaryLight,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: DfxColors.textTertiary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  radioActive: {
    borderColor: DfxColors.primary,
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: DfxColors.primary,
  },
  formatBody: {
    flex: 1,
    gap: 2,
  },
  formatTitle: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
  },
  formatDesc: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
    lineHeight: 18,
  },
  progress: {
    alignItems: 'center',
    gap: 8,
    paddingTop: 8,
  },
  progressText: {
    ...Typography.bodySmall,
    color: DfxColors.textSecondary,
  },
});
