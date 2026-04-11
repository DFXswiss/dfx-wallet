import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { ScreenContainer } from '@/components';
import { DfxColors, Typography } from '@/theme';

/**
 * Generic WebView screen for opening external URLs (KYC ident, legal docs, etc.)
 * Usage: router.push({ pathname: '/(auth)/webview', params: { url, title } })
 */
export default function WebViewScreen() {
  const router = useRouter();
  const { url, title } = useLocalSearchParams<{ url: string; title?: string }>();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()}>
          <Text style={styles.backButton}>{'\u2190'}</Text>
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>
          {title ?? 'DFX'}
        </Text>
        <View style={styles.backButton} />
      </View>
      <WebView
        source={{ uri: url ?? 'https://dfx.swiss' }}
        style={styles.webview}
        startInLoadingState
        javaScriptEnabled
      />
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
});
