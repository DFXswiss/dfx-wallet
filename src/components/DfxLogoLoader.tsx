import { useEffect, useMemo, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Circle, Path } from 'react-native-svg';
import { useReduceMotion } from '@/hooks';
import { useColors, useResolvedScheme } from '@/theme';

const VIEWBOX_WIDTH = 544;
const VIEWBOX_HEIGHT = 170;

// Rest midpoint shared by both circles (θ-independent, see motion formula below).
const CIRCLE_CENTER_X = 90;
const CIRCLE_CENTER_Y = 84.5;
const CIRCLE_TRAVEL_X = 30; // cx = 90 ± 30·cosθ
const CIRCLE_SCALE_AMPLITUDE = 0.08; // scale = 1 ± 0.08·sinθ
const CIRCLE_STROKE_WIDTH = 4;
const LOOP_DURATION_MS = 2400;
// Static pose when motion is disabled: circle 1 cx=105, circle 2 cx=75.
const REDUCE_MOTION_THETA = Math.PI / 3;

// θ runs linearly 0→2π; at least 17 sample points (22.5° steps = 360°/16),
// values computed from real cos/sin instead of an easing trick.
const SAMPLE_COUNT = 17;
const PROGRESS_INPUT_RANGE = Array.from({ length: SAMPLE_COUNT }, (_, i) => i / (SAMPLE_COUNT - 1));
const SAMPLE_THETAS = PROGRESS_INPUT_RANGE.map((v) => v * 2 * Math.PI);

type CircleConfig = {
  id: 'circle-1' | 'circle-2';
  radius: number;
  sign: 1 | -1;
};

const CIRCLE_CONFIGS: readonly CircleConfig[] = [
  { id: 'circle-1', radius: 36, sign: 1 },
  { id: 'circle-2', radius: 33, sign: -1 },
];

type CircleGeometry = CircleConfig & {
  scaleOutputRange: number[];
  staticScale: number;
};

// Scale is dimensionless (no pixel conversion needed) and prop-independent, so it's
// precomputed once at module scope instead of being rebuilt on every render. Each
// circle carries its own data so rendering never has to index a parallel array.
const CIRCLES: readonly CircleGeometry[] = CIRCLE_CONFIGS.map((config) => ({
  ...config,
  scaleOutputRange: SAMPLE_THETAS.map(
    (theta) => 1 + config.sign * CIRCLE_SCALE_AMPLITUDE * Math.sin(theta),
  ),
  staticScale: 1 + config.sign * CIRCLE_SCALE_AMPLITUDE * Math.sin(REDUCE_MOTION_THETA),
}));

function circleBoxRadius(radius: number) {
  // Box encloses the circle at maximum scale plus stroke; the translateX movement
  // intentionally extends beyond it (Svg/View don't clip, overflow visible).
  return radius * (1 + CIRCLE_SCALE_AMPLITUDE) + CIRCLE_STROKE_WIDTH;
}

type DfxLogoLoaderProps = {
  height?: number;
  testID?: string;
};

export function DfxLogoLoader({ height = 72, testID }: DfxLogoLoaderProps) {
  const { t } = useTranslation();
  const scheme = useResolvedScheme();
  const reduceMotion = useReduceMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const width = useMemo(() => (height * VIEWBOX_WIDTH) / VIEWBOX_HEIGHT, [height]);
  const scale = height / VIEWBOX_HEIGHT;
  const wordmarkStroke = scheme === 'dark' ? '#F1F4F9' : '#072440';

  useEffect(() => {
    if (reduceMotion) {
      progress.stopAnimation();
      progress.setValue(0);
      return;
    }

    const loop = Animated.loop(
      Animated.timing(progress, {
        toValue: 1,
        duration: LOOP_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [reduceMotion, progress]);

  // translateX in pixels = ±30 · cosθ · (height / 170); depends on `scale`, so it's
  // computed per render (memoized on `scale`) rather than at module scope. Each
  // circle keeps its own geometry alongside its motion data, again to avoid
  // indexing a separate array by position.
  const circleMotions = useMemo(
    () =>
      CIRCLES.map((circle) => ({
        ...circle,
        translateOutputRange: SAMPLE_THETAS.map(
          (theta) => circle.sign * CIRCLE_TRAVEL_X * Math.cos(theta) * scale,
        ),
        staticTranslateX: circle.sign * CIRCLE_TRAVEL_X * Math.cos(REDUCE_MOTION_THETA) * scale,
      })),
    [scale],
  );

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

      {circleMotions.map((circle) => {
        const boxRadius = circleBoxRadius(circle.radius);
        const boxSize = boxRadius * 2;
        const boxLeft = CIRCLE_CENTER_X - boxRadius;
        const boxTop = CIRCLE_CENTER_Y - boxRadius;

        const translateX = reduceMotion
          ? circle.staticTranslateX
          : progress.interpolate({
              inputRange: PROGRESS_INPUT_RANGE,
              outputRange: circle.translateOutputRange,
            });
        const circleScale = reduceMotion
          ? circle.staticScale
          : progress.interpolate({
              inputRange: PROGRESS_INPUT_RANGE,
              outputRange: circle.scaleOutputRange,
            });

        return (
          <Animated.View
            key={circle.id}
            style={[
              styles.circleBox,
              {
                width: boxSize * scale,
                height: boxSize * scale,
                left: boxLeft * scale,
                top: boxTop * scale,
                transform: [{ translateX }, { scale: circleScale }],
              },
            ]}
          >
            <Svg
              width="100%"
              height="100%"
              viewBox={`${boxLeft} ${boxTop} ${boxSize} ${boxSize}`}
              fill="none"
              style={styles.svg}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            >
              <Circle
                cx={CIRCLE_CENTER_X}
                cy={CIRCLE_CENTER_Y}
                r={circle.radius}
                fill="none"
                stroke="#F5516C"
                strokeWidth={CIRCLE_STROKE_WIDTH}
              />
            </Svg>
          </Animated.View>
        );
      })}
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
  circleBox: {
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
