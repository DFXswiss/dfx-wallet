import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import { useReduceMotion } from '@/hooks';
import { useColors, useResolvedScheme } from '@/theme';

const VIEWBOX_WIDTH = 544;
const VIEWBOX_HEIGHT = 170;
const ROTATION_CENTER_X = (86.1582 + 47.1374) / 2;
const ROTATION_CENTER_Y = (83.4287 + 85.009) / 2;
const ROTATION_BOX_SIZE = 140;
const ROTATION_BOX_X = ROTATION_CENTER_X - ROTATION_BOX_SIZE / 2;
const ROTATION_BOX_Y = ROTATION_CENTER_Y - ROTATION_BOX_SIZE / 2;

type DfxLogoLoaderProps = {
  height?: number;
  testID?: string;
};

export function DfxLogoLoader({ height = 72, testID }: DfxLogoLoaderProps) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const reduceMotion = useReduceMotion();
  const rotation = useRef(new Animated.Value(0)).current;
  const width = useMemo(() => (height * VIEWBOX_WIDTH) / VIEWBOX_HEIGHT, [height]);
  const scale = height / VIEWBOX_HEIGHT;
  const wordmarkStroke = scheme === 'dark' ? '#F1F4F9' : '#072440';

  useEffect(() => {
    if (reduceMotion) {
      rotation.stopAnimation();
      rotation.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(rotation, {
        toValue: 1,
        duration: 1600,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, rotation]);

  const rotate = rotation.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('pin.processing')}
      accessibilityLiveRegion="polite"
      testID={testID}
      style={[styles.root, { width, height }]}
    >
      <Svg
        width={width}
        height={height}
        viewBox="0 0 544 170"
        fill="none"
        style={styles.svg}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      >
        <Path
          fill="none"
          fillRule="evenodd"
          clipRule="evenodd"
          d="M61.5031 0H124.245C170.646 0 208.267 36.5427 208.267 84.0393C208.267 131.536 169.767 170.018 122.288 170.018H61.5031V135.504H114.046C141.825 135.504 164.541 112.789 164.541 85.009C164.541 57.2293 141.825 34.5136 114.046 34.5136H61.5031V0ZM266.25 31.5686V76.4973H338.294V108.066H266.25V170H226.906V0H355.389V31.5686H266.25ZM495.76 170L454.71 110.975L414.396 170H369.216L432.12 83.5365L372.395 0H417.072L456.183 55.1283L494.557 0H537.061L477.803 82.082L541.191 170H495.778H495.76Z"
          stroke={wordmarkStroke}
          strokeWidth={4}
          strokeLinejoin="round"
        />
      </Svg>

      <Animated.View
        style={[
          styles.circles,
          {
            width: ROTATION_BOX_SIZE * scale,
            height: ROTATION_BOX_SIZE * scale,
            left: ROTATION_BOX_X * scale,
            top: ROTATION_BOX_Y * scale,
            transform: [{ rotate }],
          },
        ]}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`${ROTATION_BOX_X} ${ROTATION_BOX_Y} ${ROTATION_BOX_SIZE} ${ROTATION_BOX_SIZE}`}
          fill="none"
          style={styles.svg}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Circle
            cx="86.1582"
            cy="83.4287"
            r="42.846"
            fill="none"
            stroke="#F5516C"
            strokeWidth={4}
          />
          <Circle
            cx="47.1374"
            cy="85.009"
            r="47.137"
            fill="none"
            stroke="#F5516C"
            strokeWidth={4}
          />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function PinProcessingOverlay() {
  const colors = useColors();

  return (
    <View
      style={[StyleSheet.absoluteFill, styles.overlay, { backgroundColor: colors.background }]}
      testID="pin-processing-overlay"
    >
      <DfxLogoLoader />
    </View>
  );
}

const styles = StyleSheet.create({
  circles: {
    position: 'absolute',
  },
  overlay: {
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 10,
  },
  root: {
    position: 'relative',
  },
  svg: {
    overflow: 'visible',
  },
});
