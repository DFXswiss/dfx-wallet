import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AppHeader, Icon, ScreenContainer } from '@/components';
import { isAllowedDfxHost } from '@/services/security/safe-url';
import { Typography, useColors, type ThemeColors } from '@/theme';

/**
 * Native legal-documents index. Mirrors realunit-app's `legal_documents_config.dart`:
 * the screen lists the agreements/notices and hands the user off to the
 * system browser (or PDF viewer) for the actual document — no in-app
 * WebView wrap. Keeps the wallet's WebView surface tight and gives the
 * user the OS' built-in copy/share/save controls.
 *
 * URLs go through `isAllowedDfxHost` so a future config change can never
 * point a "Privacy" tile at an attacker-controlled host.
 */

const LEGAL_LINKS: { id: string; titleKey: string; url: string }[] = [
  {
    id: 'tnc',
    titleKey: 'legal.terms',
    url: 'https://docs.dfx.swiss/de/tnc.html',
  },
  {
    id: 'privacy',
    titleKey: 'legal.privacy',
    url: 'https://docs.dfx.swiss/de/privacy-policy.html',
  },
  {
    id: 'disclaimer',
    titleKey: 'legal.disclaimer',
    url: 'https://docs.dfx.swiss/de/disclaimer.html',
  },
];

export default function LegalIndexScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const { t } = useTranslation();

  const open = async (url: string) => {
    if (!isAllowedDfxHost(url)) return;
    await Linking.openURL(url);
  };

  return (
    <ScreenContainer scrollable>
      <AppHeader title={t('settings.legalDocuments')} testID="legal" />
      <View style={styles.content}>
        <Text style={styles.intro}>{t('legal.intro')}</Text>
        <View style={styles.list}>
          {LEGAL_LINKS.map((entry, idx) => (
            <Pressable
              key={entry.id}
              style={({ pressed }) => [
                styles.row,
                idx < LEGAL_LINKS.length - 1 && styles.rowDivider,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                void open(entry.url);
              }}
              testID={`legal-${entry.id}`}
            >
              <View style={styles.iconBubble}>
                <Icon name="document" size={20} color={colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.rowTitle}>{t(entry.titleKey)}</Text>
              <Icon name="chevron-right" size={18} color={colors.textTertiary} />
            </Pressable>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: {
      paddingTop: 12,
      paddingBottom: 32,
      gap: 16,
    },
    intro: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
      lineHeight: 20,
    },
    list: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 14,
      gap: 12,
    },
    rowDivider: {
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: colors.border,
    },
    iconBubble: {
      width: 32,
      height: 32,
      borderRadius: 16,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowTitle: {
      flex: 1,
      ...Typography.bodyLarge,
      color: colors.text,
      fontWeight: '500',
    },
    pressed: {
      opacity: 0.7,
    },
  });
