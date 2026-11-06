import { useMemo } from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { AppHeader, Icon, ScreenContainer } from '@/components';
import { isAllowedDfxHost, isSafeHttpsUrl } from '@/services/security/safe-url';
import { Typography, useColors, type ThemeColors } from '@/theme';

/**
 * Native contact screen — no in-app WebView, just hand-offs to the OS:
 * mailto for email, tel: for phone (when listed), https for the homepage.
 * Mirrors realunit-app's `settings_contact_page.dart` pattern.
 *
 * For the in-app ticket flow ("Support") see `/(auth)/support` — that's
 * a separate Settings entry intentionally.
 */

type Channel =
  | { id: string; titleKey: string; subtitle: string; kind: 'mailto'; address: string }
  | { id: string; titleKey: string; subtitle: string; kind: 'tel'; number: string }
  | { id: string; titleKey: string; subtitle: string; kind: 'web'; url: string }
  | { id: string; titleKey: string; subtitle: string; kind: 'support' };

const CHANNELS: Channel[] = [
  {
    id: 'support',
    titleKey: 'contact.support',
    subtitle: 'In-App Tickets',
    kind: 'support',
  },
  {
    id: 'email',
    titleKey: 'contact.email',
    subtitle: 'support@dfx.swiss',
    kind: 'mailto',
    address: 'support@dfx.swiss',
  },
  {
    id: 'website',
    titleKey: 'contact.website',
    subtitle: 'dfx.swiss',
    kind: 'web',
    url: 'https://dfx.swiss',
  },
  {
    id: 'docs',
    titleKey: 'contact.docs',
    subtitle: 'docs.dfx.swiss',
    kind: 'web',
    url: 'https://docs.dfx.swiss',
  },
];

export default function ContactScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const router = useRouter();
  const { t } = useTranslation();

  const handle = async (channel: Channel) => {
    if (channel.kind === 'support') {
      router.push('/(auth)/support');
      return;
    }
    if (channel.kind === 'mailto') {
      await Linking.openURL(`mailto:${channel.address}`);
      return;
    }
    if (channel.kind === 'tel') {
      await Linking.openURL(`tel:${channel.number}`);
      return;
    }
    // web — only follow if both schema and host pass our allow-list.
    if (isSafeHttpsUrl(channel.url) && isAllowedDfxHost(channel.url)) {
      await Linking.openURL(channel.url);
    }
  };

  return (
    <ScreenContainer scrollable>
      <AppHeader title={t('settings.contact')} testID="contact" />
      <View style={styles.content}>
        <Text style={styles.intro}>{t('contact.intro')}</Text>
        <View style={styles.list}>
          {CHANNELS.map((c, idx) => (
            <Pressable
              key={c.id}
              style={({ pressed }) => [
                styles.row,
                idx < CHANNELS.length - 1 && styles.rowDivider,
                pressed && styles.pressed,
              ]}
              onPress={() => {
                void handle(c);
              }}
              testID={`contact-${c.id}`}
            >
              <View style={styles.iconBubble}>
                <Icon name={iconFor(c.kind)} size={20} color={colors.primary} strokeWidth={2.2} />
              </View>
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{t(c.titleKey)}</Text>
                <Text style={styles.rowSubtitle}>{c.subtitle}</Text>
              </View>
              <Icon name="chevron-right" size={18} color={colors.textTertiary} />
            </Pressable>
          ))}
        </View>
      </View>
    </ScreenContainer>
  );
}

function iconFor(kind: Channel['kind']): 'support' | 'document' | 'wallet' {
  if (kind === 'support') return 'support';
  if (kind === 'web') return 'document';
  return 'wallet';
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
    rowBody: {
      flex: 1,
      gap: 2,
    },
    rowTitle: {
      ...Typography.bodyLarge,
      color: colors.text,
      fontWeight: '500',
    },
    rowSubtitle: {
      ...Typography.bodySmall,
      color: colors.textSecondary,
    },
    pressed: {
      opacity: 0.7,
    },
  });
