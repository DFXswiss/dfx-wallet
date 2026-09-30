import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { GlassInputField, GlassListGroup, GlassSheet, Icon, PrimaryButton } from '@/components';
import { CONTACT_NAME_MAX_LENGTH, type ContactError } from '@/store/address-book';
import { Spacing, Typography, useColors, type ThemeColors } from '@/theme';

type FormProps = {
  title: string;
  submitLabel: string;
  /** Show the address field (new contact); off when the address is already known. */
  showAddress: boolean;
  initialName?: string;
  initialAddress?: string;
  /** Returns the failure reason, or `null` once the contact was saved. */
  onSubmit: (name: string, address: string) => ContactError | null;
  onClose: () => void;
};

const errorKey = (error: ContactError): string => {
  if (error === 'invalid-address') return 'send.contactInvalidAddress';
  if (error === 'not-found') return 'send.contactNotFound';
  return 'send.contactInvalidName';
};

/**
 * Bottom sheet with a name field (and optionally an address field) for
 * creating, saving and renaming contacts. Mount it only while it is needed:
 * it starts from `initialName` / `initialAddress` on every mount.
 */
export function ContactFormSheet({
  title,
  submitLabel,
  showAddress,
  initialName = '',
  initialAddress = '',
  onSubmit,
  onClose,
}: FormProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [name, setName] = useState(initialName);
  const [address, setAddress] = useState(initialAddress);
  const [error, setError] = useState<ContactError | null>(null);

  const handleSubmit = () => {
    const failure = onSubmit(name, address);
    setError(failure);
  };

  return (
    <GlassSheet
      visible
      position="bottom"
      avoidKeyboard
      onRequestClose={onClose}
      testID="send-contact-sheet"
    >
      <View style={styles.content}>
        <Text style={styles.title}>{title}</Text>
        <GlassInputField
          testID="send-contact-name-input"
          value={name}
          onChangeText={setName}
          placeholder={t('send.contactNamePlaceholder')}
          maxLength={CONTACT_NAME_MAX_LENGTH}
          autoCapitalize="words"
          autoCorrect={false}
        />
        {showAddress && (
          <GlassInputField
            testID="send-contact-address-input"
            value={address}
            onChangeText={setAddress}
            placeholder={t('send.contactAddressPlaceholder')}
            autoCapitalize="none"
            autoCorrect={false}
          />
        )}
        {error && (
          <Text testID="send-contact-error" style={styles.error}>
            {t(errorKey(error))}
          </Text>
        )}
        <PrimaryButton
          testID="send-contact-save-button"
          title={submitLabel}
          onPress={handleSubmit}
        />
      </View>
    </GlassSheet>
  );
}

type ActionProps = {
  name: string;
  onRename: () => void;
  onDelete: () => void;
  onClose: () => void;
};

/** Long-press menu of a contact: rename or delete. */
export function ContactActionSheet({ name, onRename, onDelete, onClose }: ActionProps) {
  const { t } = useTranslation();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <GlassSheet visible position="bottom" onRequestClose={onClose} testID="send-contact-actions">
      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {name}
        </Text>
        <GlassListGroup variant="quiet">
          <GlassListGroup.Row
            onPress={onRename}
            testID="send-contact-action-rename"
            accessibilityRole="button"
            style={styles.actionRow}
          >
            <Icon name="edit" size={20} color={colors.text} />
            <Text style={styles.actionLabel}>{t('send.contactRename')}</Text>
          </GlassListGroup.Row>
          <GlassListGroup.Row
            onPress={onDelete}
            last
            testID="send-contact-action-delete"
            accessibilityRole="button"
            style={styles.actionRow}
          >
            <Icon name="close" size={20} color={colors.error} />
            <Text style={[styles.actionLabel, styles.actionLabelDanger]}>
              {t('send.contactDelete')}
            </Text>
          </GlassListGroup.Row>
        </GlassListGroup>
      </View>
    </GlassSheet>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    content: {
      gap: Spacing.base,
    },
    title: {
      ...Typography.headlineSmall,
      color: colors.text,
    },
    error: {
      ...Typography.bodySmall,
      color: colors.error,
    },
    actionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: Spacing.md,
    },
    actionLabel: {
      ...Typography.bodyLarge,
      fontWeight: '600',
      color: colors.text,
    },
    actionLabelDanger: {
      color: colors.error,
    },
  });
