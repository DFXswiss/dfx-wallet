import { StyleSheet, View } from 'react-native';

import { GlassPill } from '@/components/GlassPill';
import { GlassSurface } from '@/components/GlassSurface';
import { Radius, Spacing } from '@/theme';

type SegmentedOption = {
  key: string;
  label: string;
};

type Props = {
  options: SegmentedOption[];
  value: string;
  onChange: (key: string) => void;
  size?: 'md' | 'sm';
  testIDPrefix: string;
};

export function SegmentedControl({ options, value, onChange, size = 'md', testIDPrefix }: Props) {
  return (
    <View accessibilityRole="tablist">
      <GlassSurface variant="quiet" radius={Radius.md} style={styles.container}>
        {options.map((option) => {
          const selected = option.key === value;

          return (
            <GlassPill
              key={option.key}
              selected={selected}
              shape="rounded"
              onPress={() => {
                if (!selected) onChange(option.key);
              }}
              style={styles.segment}
              contentStyle={size === 'sm' ? styles.segmentSmall : undefined}
              testID={`${testIDPrefix}-${option.key}`}
              accessibilityRole="tab"
            >
              {option.label}
            </GlassPill>
          );
        })}
      </GlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: Spacing.xs,
  },
  segment: {
    flex: 1,
  },
  segmentSmall: {
    paddingVertical: Spacing.xs,
  },
});
