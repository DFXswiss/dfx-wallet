import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { groupAddress } from '@/features/transfer/groupAddress';
import { Typography, useColors, type ThemeColors } from '@/theme';

type Props = {
  address: string;
  testID?: string;
};

type Segment = {
  text: string;
  emphasized: boolean;
};

function lineSegments(line: string, original: string, offset: number): Segment[] {
  const segments: Segment[] = [];
  let addressIndex = offset;

  for (const character of line) {
    const isSpace = character === ' ';
    const emphasized =
      !isSpace && (addressIndex < 4 || addressIndex >= Math.max(4, original.length - 5));
    const previous = segments.at(-1);

    if (previous?.emphasized === emphasized) {
      previous.text += character;
    } else {
      segments.push({ text: character, emphasized });
    }

    if (!isSpace) addressIndex += 1;
  }

  return segments;
}

export function GroupedAddress({ address, testID }: Props) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const grouped = useMemo(() => groupAddress(address), [address]);
  let offset = 0;

  return (
    <View style={styles.container}>
      <Text
        style={styles.address}
        accessible={false}
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
      >
        {grouped.lines.map((line, lineIndex) => {
          const segments = lineSegments(line, grouped.original, offset);
          offset += line.replace(/ /g, '').length;

          return (
            <Text key={`${lineIndex}-${line}`}>
              {segments.map((segment, segmentIndex) => (
                <Text
                  key={`${segmentIndex}-${segment.text}`}
                  style={segment.emphasized ? styles.emphasized : undefined}
                >
                  {segment.text}
                </Text>
              ))}
              {lineIndex < grouped.lines.length - 1 ? '\n' : null}
            </Text>
          );
        })}
      </Text>
      <Text
        testID={testID}
        style={styles.selectableOriginal}
        selectable
        accessibilityLabel={grouped.accessibilityLabel}
      >
        {grouped.original}
      </Text>
    </View>
  );
}

const makeStyles = (colors: ThemeColors) =>
  StyleSheet.create({
    container: {
      position: 'relative',
      maxWidth: 290,
    },
    address: {
      ...Typography.address,
      color: colors.text,
      textAlign: 'center',
    },
    emphasized: {
      fontWeight: '800',
    },
    selectableOriginal: {
      ...StyleSheet.absoluteFillObject,
      ...Typography.address,
      color: colors.transparent,
      textAlign: 'center',
    },
  });
