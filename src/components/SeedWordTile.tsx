import { useMemo } from 'react';
import { StyleSheet, Text } from 'react-native';
import { GlassSurface } from './GlassSurface';
import { Radius, Typography, useColors, type ThemeColors } from '@/theme';

type Props = {
  /** 0-based index; the tile renders `index + 1`. */
  index: number;
  word: string;
  /** Masks `word` behind dots while keeping the tile's layout — for
   *  screenshot-guarded reveal flows. */
  hidden?: boolean;
  testID?: string;
};

const MASK = '••••';

/**
 * Index + word tile on a `quiet` glass surface, used by the seed-phrase
 * export/verify/restore screens (mirrors the current `wordCard` markup in
 * `SeedExportScreenImpl`, moved onto glass and made reusable).
 */
export function SeedWordTile({ index, word, hidden = false, testID }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <GlassSurface
      variant="quiet"
      radius={Radius.xs}
      style={styles.tile}
      {...(testID ? { testID } : {})}
    >
      <Text style={styles.index}>{index + 1}.</Text>
      <Text style={styles.word} numberOfLines={1}>
        {hidden ? MASK : word}
      </Text>
    </GlassSurface>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    tile: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    index: {
      ...Typography.bodySmall,
      color: colors.textTertiary,
      width: 24,
    },
    word: {
      ...Typography.bodyMedium,
      color: colors.text,
    },
  });
