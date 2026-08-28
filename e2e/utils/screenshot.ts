import * as fs from 'fs';
import * as path from 'path';
import { device } from 'detox';
import { toMatchImageSnapshot } from 'jest-image-snapshot';

// Detox replaces the global `expect` with its own matcher API.
// We need Jest's original `expect` for jest-image-snapshot.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { expect: jestExpect } = require('expect') as { expect: jest.Expect };

jestExpect.extend({ toMatchImageSnapshot });

const BASELINES_DIR = path.resolve(__dirname, '..', '__baselines__');
const DIFF_DIR = path.resolve(__dirname, '..', '__diffs__');

/**
 * Takes a screenshot and compares it against a stored baseline image.
 *
 * On first run the screenshot is saved as the new baseline (test passes).
 * On subsequent runs a pixel-by-pixel diff is performed; the test fails
 * if the difference exceeds the configured threshold.
 *
 * @param name  Unique name for this screenshot (e.g. "welcome-screen").
 *              Used as both the Detox artifact name and the baseline file name.
 */
export async function expectScreenToMatchBaseline(name: string): Promise<void> {
  const artifactPath = await device.takeScreenshot(name);
  // eslint-disable-next-line security/detect-non-literal-fs-filename
  const screenshot = fs.readFileSync(artifactPath);

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
