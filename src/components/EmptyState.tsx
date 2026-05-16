import { ReactNode, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Typography, useColors, type ThemeColors } from '@/theme';
import { Icon } from './Icon';

type IconName = Parameters<typeof Icon>[0]['name'];

type Props = {
  icon?: IconName;
  title: string;
  description?: string;
  /** Optional CTA — typically a PrimaryButton from the caller. */
  action?: ReactNode;
  testID?: string;
};

/**
 * Centred empty-state with optional icon-bubble, title, description and
 * action slot. Used wherever a list, ticket history, or settings page
 * has no data — gives users an anchor and clear next step instead of a
 * blank section.
 */
export function EmptyState({ icon, title, description, action, testID }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  return (
    <View style={styles.container} testID={testID}>
      {icon ? (
        <View style={styles.iconBubble}>
          <Icon name={icon} size={28} color={colors.primary} strokeWidth={1.8} />
        </View>
      ) : null}
      <Text style={styles.title}>{title}</Text>
      {description ? <Text style={styles.description}>{description}</Text> : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
      paddingVertical: 48,
      gap: 14,
    },
    iconBubble: {
      width: 64,
      height: 64,
      borderRadius: 22,
      backgroundColor: colors.primaryLight,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 4,
    },
    title: {
      ...Typography.headlineSmall,
      color: colors.text,
      textAlign: 'center',
    },
    description: {
      ...Typography.bodyMedium,
      color: colors.textSecondary,
      textAlign: 'center',
      lineHeight: 22,
      maxWidth: 320,
    },
    action: {
      marginTop: 12,
      alignSelf: 'stretch',
    },
  });
