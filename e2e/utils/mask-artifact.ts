import * as fs from 'fs';
import { maskPngBuffer, type ScreenshotMaskRect } from './mask-png';

type ArtifactBytes = Uint8Array<ArrayBuffer>;

type ArtifactFs = {
  readFileSync: (path: string) => ArtifactBytes;
  rmSync: (path: string, options: { force: true }) => void;
};

type ArtifactMask = (
  screenshot: ArtifactBytes,
  rects: readonly ScreenshotMaskRect[],
  windowWidth: number,
) => ArtifactBytes;

// `fs.readFileSync` returns a Node Buffer. A direct `= fs` default does not
// match this narrowed shape: the last overload also returns `string`.
const defaultArtifactFs: ArtifactFs = {
  readFileSync: (filePath: string) => fs.readFileSync(filePath),
  rmSync: (filePath: string, options: { force: true }) => {
    fs.rmSync(filePath, options);
  },
};

function removeRawArtifact(fsApi: ArtifactFs, artifactPath: string): void {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fsApi.rmSync(artifactPath, { force: true });
  } catch {
    // Preserve the original read or mask error.
  }
}

/**
 * Masks a Detox screenshot in memory and deletes the raw file.
 *
 * Detox writes the capture into the OS temp directory. Writing the masked
 * bytes back would recreate that temp file, which CodeQL reports as an
 * insecure temporary file. The unmasked image is removed on every path,
 * including when reading or masking fails.
 */
export function maskArtifactInPlace(
  artifactPath: string,
  rects: readonly ScreenshotMaskRect[],
  windowWidth: number,
  fsApi: ArtifactFs = defaultArtifactFs,
  mask: ArtifactMask = maskPngBuffer,
): ArtifactBytes {
  let screenshot: ArtifactBytes;
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    screenshot = fsApi.readFileSync(artifactPath);
  } catch (error) {
    removeRawArtifact(fsApi, artifactPath);
    throw error;
  }

  let maskedScreenshot: ArtifactBytes;
  try {
    maskedScreenshot = mask(screenshot, rects, windowWidth);
  } catch (error) {
    removeRawArtifact(fsApi, artifactPath);
    throw error;
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fsApi.rmSync(artifactPath, { force: true });
  return maskedScreenshot;
}
