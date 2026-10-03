import * as fs from 'fs';
import { maskPngBuffer, type ScreenshotMaskRect } from './mask-png';

type ArtifactFs = {
  readFileSync: (path: string) => Buffer;
  writeFileSync: (path: string, data: Buffer) => void;
  rmSync: (path: string, options: { force: true }) => void;
};

type ArtifactMask = (
  screenshot: Buffer,
  rects: readonly ScreenshotMaskRect[],
  windowWidth: number,
) => Buffer;

export function maskArtifactInPlace(
  artifactPath: string,
  rects: readonly ScreenshotMaskRect[],
  windowWidth: number,
  fsApi: ArtifactFs = fs,
  mask: ArtifactMask = maskPngBuffer,
): Buffer {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    const screenshot = fsApi.readFileSync(artifactPath);
    const maskedScreenshot = mask(screenshot, rects, windowWidth);
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fsApi.writeFileSync(artifactPath, maskedScreenshot);
    return maskedScreenshot;
  } catch (error) {
    try {
      // eslint-disable-next-line security/detect-non-literal-fs-filename
      fsApi.rmSync(artifactPath, { force: true });
    } catch {
      // Preserve the original masking or write error.
    }
    throw error;
  }
}
