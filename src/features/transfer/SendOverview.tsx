import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { useTranslation } from 'react-i18next';

import {
  GlassCard,
  GlassInputField,
  GlassListGroup,
  GlassSurface,
  Icon,
  QrCode,
} from '@/components';
import { FEATURES } from '@/config/features';
import { ContactAvatar } from '@/features/transfer/ContactAvatar';
import { UnitGlyph } from '@/features/transfer/UnitGlyph';
import { isIban, isPlausibleAddress, maskIban, shortenAddress } from '@/features/transfer/address';
import type { BankAccountRow } from '@/features/transfer/useBankAccounts';
import type { Contact } from '@/store';
import {
  IconTile,
  Layout,
  Radius,
  Spacing,
  Typography,
  useColors,
  type ThemeColors,
} from '@/theme';

const COMPOSER_HEIGHT = 56;
const CONTACT_SIZE = 56;
const QR_SIZE = 56;
const QR_QUIET_ZONE = 4;
const ACCOUNT_ICON_SIZE = 36;
const ACTION_HEIGHT = 44;

type Props = {
  /** All contacts, most recently used first. */
  contacts: Contact[];
  query: string;
  onQueryChange: (value: string) => void;
  /** The user's own Bitcoin address; empty while the wallet is not ready. */
  ownAddress: string;
  /** Balance of the default asset ("0.0231 BTC"), `null` while unknown. */
  balanceLabel: string | null;
  bankAccounts: BankAccountRow[];
  onSubmitAddress: (address: string) => void;
  onSelectContact: (contact: Contact) => void;
  onContactActions: (contact: Contact) => void;
  onNewContact: () => void;
  onShowOwnCode: () => void;
  onOpenBuy: () => void;
  onOpenSell: () => void;
  onPaste: () => void;
};

type AccountRowProps = {
  icon: ReactNode;
  title: string;
  subtitle?: string;
  right?: ReactNode;
  last?: boolean;
  onPress?: () => void;
  testID: string;
  styles: ReturnType<typeof makeStyles>;
};

function AccountRow({
  icon,
  title,
  subtitle,
  right,
  last,
  onPress,
  testID,
  styles,
}: AccountRowProps) {
  return (
    <GlassListGroup.Row
      style={styles.accountRow}
      testID={testID}
      {...(onPress ? { onPress, accessibilityRole: 'button' as const } : {})}
      {...(last ? { last } : {})}
    >
      {icon}
      <View style={styles.accountText}>
        <Text style={styles.accountTitle}>{title}</Text>
        {subtitle ? <Text style={styles.accountSubtitle}>{subtitle}</Text> : null}
      </View>
      {right}
    </GlassListGroup.Row>
  );
}

type CodeActionProps = {
  icon: 'copy' | 'share';
  label: string;
  onPress: () => void;
  disabled: boolean;
  testID: string;
  styles: ReturnType<typeof makeStyles>;
  color: string;
};

function CodeAction({ icon, label, onPress, disabled, testID, styles, color }: CodeActionProps) {
  return (
    <Pressable
      style={styles.codeAction}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <GlassSurface variant="quiet" radius={Radius.sm} style={styles.codeActionSurface}>
        <Icon name={icon} size={16} color={color} />
        <Text style={styles.codeActionLabel}>{label}</Text>
      </GlassSurface>
    </Pressable>
  );
}

/**
 * First step of the send flow ("An wen?"): one composer for name, address or
 * IBAN, the user's own code to share, the contact rail and the user's
 * accounts. The screen shell (header, back, scanner) lives in the send
 * route; everything here reports what the user picked through callbacks.
 */
export function SendOverview({
  contacts,
  query,
  onQueryChange,
  ownAddress,
  balanceLabel,
  bankAccounts,
  onSubmitAddress,
  onSelectContact,
  onContactActions,
  onNewContact,
  onShowOwnCode,
  onOpenBuy,
  onOpenSell,
  onPaste,
}: Props) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [copied, setCopied] = useState(false);

  const text = query.trim();
  const isBankTarget = FEATURES.BUY_SELL && isIban(text);
  const isAddressTarget = !isIban(text) && isPlausibleAddress(text);
  const needle = text.toLowerCase();
  const visibleContacts = needle
    ? contacts.filter(
        (c) => c.name.toLowerCase().includes(needle) || c.address.toLowerCase().includes(needle),
      )
    : contacts;
  const first = contacts[0];
  const recentId = first?.lastUsedAt !== undefined ? first.id : null;
  const hasBank = FEATURES.BUY_SELL && bankAccounts.length > 0;
  const accountCount = 1 + (FEATURES.BUY_SELL ? bankAccounts.length : 0);

  const handleCopy = async () => {
    await Clipboard.setStringAsync(ownAddress);
    void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = () => {
    void Share.share({ message: ownAddress });
  };

  return (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      testID="send-overview-step"
    >
      <Text style={styles.headline}>{t('send.overviewTitle')}</Text>
      <Text style={styles.subline}>
        {contacts.length === 0 ? t('send.overviewSubtitleEmpty') : t('send.overviewSubtitle')}
      </Text>

      <View style={styles.composer}>
        <GlassInputField
          testID="send-recipient-input"
          value={query}
          onChangeText={onQueryChange}
          placeholder={t('send.composerPlaceholder')}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="go"
          onSubmitEditing={() => {
            if (isAddressTarget) onSubmitAddress(text);
          }}
          style={styles.composerInput}
        />
        <Pressable
          style={styles.pasteButton}
          onPress={onPaste}
          testID="send-paste-button"
          accessibilityRole="button"
          accessibilityLabel={t('send.paste')}
        >
          <Icon name="paste" size={20} color={colors.white} />
        </Pressable>
      </View>

      {isAddressTarget && (
        <GlassCard
          tone="accent"
          onPress={() => onSubmitAddress(text)}
          testID="send-recipient-continue"
          accessibilityRole="button"
          contentStyle={styles.hintRow}
          style={styles.hint}
        >
          <Text style={styles.hintText} numberOfLines={1}>
            {t('send.sendToAddress', { address: shortenAddress(text) })}
          </Text>
          <Icon name="arrow-right" size={18} color={colors.primary} />
        </GlassCard>
      )}
      {isBankTarget && (
        <GlassCard
          tone="accent"
          onPress={onOpenSell}
          testID="send-iban-payout"
          accessibilityRole="button"
          contentStyle={styles.hintRow}
          style={styles.hint}
        >
          <Icon name="bank" size={18} color={colors.primary} />
          <Text style={styles.hintText}>{t('send.payoutToBank')}</Text>
          <Icon name="arrow-right" size={18} color={colors.primary} />
        </GlassCard>
      )}

      <GlassCard style={styles.section} contentStyle={styles.codeCard} testID="send-code-card">
        <View style={styles.codeTop}>
          <Pressable
            style={styles.codeQr}
            onPress={onShowOwnCode}
            testID="send-code-qr"
            accessibilityRole="button"
            accessibilityLabel={t('send.showCode')}
          >
            <QrCode value={ownAddress} size={QR_SIZE} quietZone={QR_QUIET_ZONE} />
            <View style={styles.expandBadge} pointerEvents="none">
              <Icon name="expand" size={12} color={colors.white} strokeWidth={2} />
            </View>
          </Pressable>
          <Pressable
            style={styles.codeText}
            onPress={onShowOwnCode}
            accessibilityRole="button"
            accessibilityLabel={t('send.showCode')}
          >
            <Text style={styles.label}>{t('send.yourCode')}</Text>
            <Text style={styles.codeAddress} numberOfLines={1} testID="send-code-address">
              {ownAddress ? shortenAddress(ownAddress) : t('receive.walletNotInitialized')}
            </Text>
            <Text style={styles.codeHint} testID="send-code-hint">
              {t('send.tapToEnlarge')}
            </Text>
          </Pressable>
        </View>
        <View style={styles.codeActions}>
          <CodeAction
            icon="copy"
            label={copied ? t('common.copied') : t('common.copy')}
            onPress={handleCopy}
            disabled={!ownAddress}
            testID="send-code-copy"
            styles={styles}
            color={colors.text}
          />
          <CodeAction
            icon="share"
            label={t('send.share')}
            onPress={handleShare}
            disabled={!ownAddress}
            testID="send-code-share"
            styles={styles}
            color={colors.text}
          />
        </View>
        {FEATURES.BUY_SELL && (
          <Pressable
            style={styles.buyLink}
            onPress={onOpenBuy}
            testID="send-code-buy"
            accessibilityRole="link"
          >
            <Text style={styles.buyLinkText}>{t('send.buyCrypto')}</Text>
            <Icon name="arrow-right" size={14} color={colors.primary} />
          </Pressable>
        )}
      </GlassCard>

      <View style={styles.section}>
        <Text style={styles.label}>
          {t('send.contactsLabel', { count: visibleContacts.length })}
        </Text>
        {contacts.length === 0 ? (
          <GlassCard variant="quiet" testID="send-contacts-empty">
            <Text style={styles.emptyText}>{t('send.contactsEmpty')}</Text>
          </GlassCard>
        ) : (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            style={styles.rail}
            contentContainerStyle={styles.railContent}
          >
            {visibleContacts.map((contact) => (
              <Pressable
                key={contact.id}
                style={styles.contactItem}
                onPress={() => onSelectContact(contact)}
                onLongPress={() => onContactActions(contact)}
                testID={`send-contact-${contact.id}`}
                accessibilityRole="button"
                accessibilityLabel={contact.name}
              >
                <ContactAvatar
                  name={contact.name}
                  size={CONTACT_SIZE}
                  recent={contact.id === recentId}
                  {...(contact.assetSymbol ? { badgeSymbol: contact.assetSymbol } : {})}
                />
                <Text style={styles.contactName} numberOfLines={1}>
                  {contact.name}
                </Text>
              </Pressable>
            ))}
            <Pressable
              style={styles.contactItem}
              onPress={onNewContact}
              testID="send-contact-new"
              accessibilityRole="button"
              accessibilityLabel={t('send.contactNew')}
            >
              <GlassSurface variant="quiet" radius={CONTACT_SIZE / 2} style={styles.newContact}>
                <Icon name="plus" size={20} color={colors.primary} />
              </GlassSurface>
              <Text style={styles.contactName}>{t('send.contactNew')}</Text>
            </Pressable>
          </ScrollView>
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.label}>{t('send.accountsLabel', { count: accountCount })}</Text>
        <GlassListGroup testID="send-accounts">
          {hasBank &&
            bankAccounts.map((account) => (
              <AccountRow
                key={account.id}
                testID={`send-account-bank-${account.id}`}
                styles={styles}
                icon={
                  <View style={styles.bankIcon}>
                    <Icon name="bank" size={18} color={colors.primary} />
                  </View>
                }
                title={account.label ?? t('send.accountBank')}
                subtitle={maskIban(account.iban)}
                right={<Text style={styles.accountAction}>{t('send.payout')}</Text>}
                onPress={onOpenSell}
              />
            ))}
          {FEATURES.BUY_SELL && !hasBank && (
            <AccountRow
              testID="send-account-bank-add"
              styles={styles}
              icon={
                <GlassSurface variant="quiet" radius={Radius.sm} style={styles.addIcon}>
                  <Icon name="plus" size={18} color={colors.primary} />
                </GlassSurface>
              }
              title={t('send.accountBankAdd')}
              subtitle={t('send.accountBankAddHint')}
              onPress={onOpenSell}
            />
          )}
          <AccountRow
            testID="send-account-dfx"
            styles={styles}
            icon={<UnitGlyph symbol="BTC" size={ACCOUNT_ICON_SIZE} />}
            title={t('send.accountDfx')}
            subtitle={ownAddress ? shortenAddress(ownAddress) : t('receive.walletNotInitialized')}
            last
            right={
              balanceLabel ? (
                <Text style={styles.accountBalance} testID="send-account-balance">
                  {balanceLabel}
                </Text>
              ) : null
            }
          />
        </GlassListGroup>
      </View>
    </ScrollView>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    scroll: {
      flex: 1,
    },
    scrollContent: {
      paddingHorizontal: Layout.screenPadding,
      paddingTop: Spacing.base,
      paddingBottom: Spacing.xxl,
    },
    headline: {
      ...Typography.displayMedium,
      color: colors.text,
    },
    subline: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.textSecondary,
      marginTop: Spacing.xs,
    },
    composer: {
      marginTop: Spacing.base,
    },
    composerInput: {
      height: COMPOSER_HEIGHT - 2 * Spacing.md,
      paddingRight: IconTile.sm.size + Spacing.sm,
    },
    pasteButton: {
      position: 'absolute',
      top: (COMPOSER_HEIGHT - IconTile.sm.size) / 2,
      right: Spacing.sm,
      width: IconTile.sm.size,
      height: IconTile.sm.size,
      borderRadius: IconTile.sm.radius,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    hint: {
      marginTop: Spacing.md,
    },
    hintRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.sm,
    },
    hintText: {
      flex: 1,
      ...Typography.bodyMedium,
      fontWeight: '600',
      color: colors.primary,
    },
    section: {
      marginTop: Layout.sectionGap,
      gap: Spacing.sm,
    },
    label: {
      ...Typography.sectionLabel,
      color: colors.textSecondary,
    },
    codeCard: {
      gap: Spacing.sm,
    },
    codeTop: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    codeQr: {
      position: 'relative',
    },
    expandBadge: {
      position: 'absolute',
      right: -6,
      bottom: -6,
      width: 22,
      height: 22,
      borderRadius: Radius.sm,
      backgroundColor: colors.primary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    codeText: {
      flex: 1,
      gap: Spacing.xs,
    },
    codeAddress: {
      ...Typography.monoLarge,
      color: colors.text,
    },
    codeHint: {
      ...Typography.bodySmall,
      color: colors.primary,
    },
    codeActions: {
      flexDirection: 'row',
      gap: Spacing.sm,
    },
    codeAction: {
      flex: 1,
    },
    codeActionSurface: {
      minHeight: ACTION_HEIGHT,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: Spacing.sm,
    },
    codeActionLabel: {
      ...Typography.bodyMedium,
      fontWeight: '500',
      color: colors.text,
    },
    buyLink: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      gap: Spacing.xs,
    },
    buyLinkText: {
      ...Typography.bodyMedium,
      fontWeight: '500',
      color: colors.primary,
    },
    emptyText: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      lineHeight: 24,
      color: colors.textSecondary,
    },
    // The rail bleeds to the screen edges so a scrolled avatar slides under
    // the edge; its content padding puts the first avatar back on the
    // screen padding line that every other block sits on.
    rail: {
      marginHorizontal: -Layout.screenPadding,
    },
    railContent: {
      paddingHorizontal: Layout.screenPadding,
      paddingVertical: Spacing.sm,
      gap: Spacing.base,
    },
    contactItem: {
      width: CONTACT_SIZE,
      alignItems: 'center',
      gap: Spacing.sm,
    },
    contactName: {
      ...Typography.bodySmall,
      fontWeight: '500',
      color: colors.textSecondary,
    },
    newContact: {
      width: CONTACT_SIZE,
      height: CONTACT_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
    accountRow: {
      minHeight: ACCOUNT_ICON_SIZE + 2 * Spacing.md,
      paddingVertical: Spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    accountText: {
      flex: 1,
      gap: 2,
    },
    accountTitle: {
      ...Typography.bodyLarge,
      fontWeight: '700',
      color: colors.text,
    },
    accountSubtitle: {
      ...Typography.mono,
      color: colors.textSecondary,
    },
    accountBalance: {
      ...Typography.mono,
      color: colors.text,
      textAlign: 'right',
    },
    accountAction: {
      ...Typography.bodyMedium,
      fontWeight: '500',
      color: colors.primary,
    },
    bankIcon: {
      width: ACCOUNT_ICON_SIZE,
      height: ACCOUNT_ICON_SIZE,
      borderRadius: Radius.sm,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
    },
    addIcon: {
      width: ACCOUNT_ICON_SIZE,
      height: ACCOUNT_ICON_SIZE,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
