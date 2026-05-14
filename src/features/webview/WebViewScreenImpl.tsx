import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { ScreenContainer } from '@/components';
import { dfxAuthService } from '@/features/dfx-backend/services';
import { isAllowedDfxHost, isDfxOwnedHost } from '@/services/security/safe-url';
import { DfxColors, Typography } from '@/theme';

/**
 * Generic WebView screen for opening external URLs (KYC ident, legal docs, …).
 *
 * Inputs come from route params, which means they ride deep links and
 * server payloads. We only render the WebView when the target URL is
 * https:// and the host is on the explicit DFX allow-list. Anything else
 * shows a refusal screen — never load `javascript:` payloads or arbitrary
 * untrusted hosts inside the wallet's WebView (the WebView shares the
 * native bridge and could be coerced into firing native events).
 *
 * Usage: router.push({ pathname: '/(auth)/webview', params: { url, title } })
 */
export default function WebViewScreen() {
  const router = useRouter();
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();
  const safe = typeof url === 'string' && isAllowedDfxHost(url);
  const token =
    typeof url === 'string' && isDfxOwnedHost(url) ? dfxAuthService.getAccessToken() : null;
  const source =
    typeof url === 'string'
      ? {
          uri: url,
          ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
        }
      : undefined;

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backButton}>{'←'}</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title ?? 'DFX'}
        </Text>
        <View style={styles.backButton} />
      </View>
      {safe ? (
        <WebView
          source={source}
          style={styles.webview}
          startInLoadingState
          javaScriptEnabled
          // Only allow the original host's navigations; any link that points
          // off-domain bounces back through the request handler.
          originWhitelist={['https://*']}
          onShouldStartLoadWithRequest={(req) => isAllowedDfxHost(req.url)}
        />
      ) : (
        <View style={styles.errorBox}>
          <Text style={styles.errorTitle}>Link blockiert</Text>
          <Text style={styles.errorBody}>
            Diese Seite wurde aus Sicherheitsgründen nicht geöffnet.
          </Text>
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  backButton: {
    fontSize: 24,
    color: DfxColors.text,
    width: 32,
  },
  title: {
    ...Typography.bodyLarge,
    fontWeight: '600',
    color: DfxColors.text,
    flex: 1,
    textAlign: 'center',
  },
  webview: {
    flex: 1,
  },
  errorBox: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  errorTitle: {
    ...Typography.headlineSmall,
    color: DfxColors.error,
  },
  errorBody: {
    ...Typography.bodyMedium,
    color: DfxColors.textSecondary,
    textAlign: 'center',
  },
});
