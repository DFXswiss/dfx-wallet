import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import { AppHeader, Icon, ScreenContainer } from '@/components';
import { isAllowedDfxHost } from '@/services/security/safe-url';
import { DfxColors, Typography } from '@/theme';

/**
 * Native legal-documents index. Mirrors realunit-app's `legal_documents_config.dart`:
 * the screen lists the agreements/notices and opens each in the in-app
 * WebView so the user never leaves the wallet shell. The WebView wrap
 * also keeps the visual continuity (no jarring system browser tab) and
 * preserves the lock-screen / app-state guarantees.
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
  const { t } = useTranslation();
  const router = useRouter();

  const open = (url: string, title: string) => {
    if (!isAllowedDfxHost(url)) return;
    router.push({ pathname: '/(auth)/webview', params: { url, title } });
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
              onPress={() => open(entry.url, t(entry.titleKey))}
              testID={`legal-${entry.id}`}
            >
              <View style={styles.iconBubble}>
                <Icon name="document" size={20} color={DfxColors.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.rowTitle}>{t(entry.titleKey)}</Text>
              <Icon name="chevron-right" size={18} color={DfxColors.textTertiary} />
            </Pressable>
          ))}
        </View>
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
  list: {
    backgroundColor: DfxColors.surface,
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
    borderBottomColor: DfxColors.border,
  },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: DfxColors.primaryLight,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowTitle: {
    flex: 1,
    ...Typography.bodyLarge,
    color: DfxColors.text,
    fontWeight: '500',
  },
  pressed: {
    opacity: 0.7,
  },
});
