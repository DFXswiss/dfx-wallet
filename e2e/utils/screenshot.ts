import * as fs from 'fs';
import * as path from 'path';
import { by, device, element } from 'detox';
import { toMatchImageSnapshot } from 'jest-image-snapshot';
import { PNG } from 'pngjs';
import {
  elementFramesFromAttributes,
  maskPngRegions,
  type ScreenshotMaskRect,
} from './mask-png';

// Detox replaces the global `expect` with its own matcher API.
// We need Jest's original `expect` for jest-image-snapshot.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { expect: jestExpect } = require('expect') as { expect: jest.Expect };

jestExpect.extend({ toMatchImageSnapshot });

const BASELINES_DIR = path.resolve(__dirname, '..', '__baselines__');
const DIFF_DIR = path.resolve(__dirname, '..', '__diffs__');
// The visual suite is iOS-only. Fabric and the legacy renderer use different
// native root classes, but both expose a screen-space frame in logical points.
const IOS_ROOT_VIEW_TYPES = ['RCTSurfaceHostingProxyRootView', 'RCTRootContentView'] as const;

type ScreenshotOptions = {
  maskTestIDs?: string[];
};

async function getMaskFrames(testIDs: readonly string[]): Promise<ScreenshotMaskRect[]> {
  const frameGroups = await Promise.all(
    testIDs.map(async (testID) => {
      const attributes = await element(by.id(testID)).getAttributes();
      return elementFramesFromAttributes(attributes, `mask testID "${testID}"`);
    }),
  );
  return frameGroups.flat();
}

async function getWindowWidth(): Promise<number> {
  let lastError: unknown;
  for (const rootViewType of IOS_ROOT_VIEW_TYPES) {
    try {
      const attributes = await element(by.type(rootViewType)).getAttributes();
      const frames = elementFramesFromAttributes(attributes, rootViewType);
      const windowWidth = Math.max(...frames.map((frame) => frame.width));
      if (Number.isFinite(windowWidth) && windowWidth > 0) return windowWidth;
      lastError = new Error(`${rootViewType} returned no positive window width`);
    } catch (error) {
      lastError = error;
    }
  }

  const detail = lastError instanceof Error ? `: ${lastError.message}` : '';
  throw new Error(`Unable to read the iOS root-view width${detail}`);
}

/**
 * Takes a screenshot and compares it against a stored baseline image.
 *
 * On first run the screenshot is saved as the new baseline (test passes).
 * On subsequent runs a pixel-by-pixel diff is performed; the test fails
 * if the difference exceeds the configured threshold.
 *
 * @param name     Unique name for this screenshot (e.g. "welcome-screen").
 *                 Used as both the Detox artifact name and the baseline file name.
 * @param options  Optional test IDs whose on-screen frames must be masked.
 */
export async function expectScreenToMatchBaseline(
  name: string,
  options: ScreenshotOptions = {},
): Promise<void> {
  const maskTestIDs = options.maskTestIDs ?? [];
  const maskFrames = maskTestIDs.length > 0 ? await getMaskFrames(maskTestIDs) : [];
  const windowWidth = maskFrames.length > 0 ? await getWindowWidth() : null;
  const artifactPath = await device.takeScreenshot(name);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  let screenshot = fs.readFileSync(artifactPath);

  if (windowWidth !== null) {
    const png = PNG.sync.read(screenshot);
    maskPngRegions(png, maskFrames, png.width / windowWidth);
    screenshot = PNG.sync.write(png);
  }

  jestExpect(screenshot).toMatchImageSnapshot({
    customSnapshotsDir: BASELINES_DIR,
    customSnapshotIdentifier: name,
    customDiffDir: DIFF_DIR,
    // Allow 1% pixel difference to absorb anti-aliasing, font rendering,
    // and GPU differences across local machines and CI runners.
    failureThreshold: 1,
    failureThresholdType: 'percent',
  });
}
