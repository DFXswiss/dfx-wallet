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

function rethrowAfterDeletingRawArtifact(
  fsApi: ArtifactFs,
  artifactPath: string,
  originalError: unknown,
): never {
  try {
    // eslint-disable-next-line security/detect-non-literal-fs-filename
    fsApi.rmSync(artifactPath, { force: true });
  } catch (cleanupError) {
    throw new AggregateError(
      [originalError, cleanupError],
      `Unmasked screenshot may still remain at ${artifactPath}`,
    );
  }
  throw originalError;
}

/**
 * Masks a Detox screenshot in memory and deletes the raw file.
 *
 * Detox writes the capture into the OS temp directory. Writing the masked
 * bytes back would recreate that temp file, which CodeQL reports as an
 * insecure temporary file. Deletion is attempted on every path. A deletion
 * error is never swallowed: with the original read or mask error it becomes
 * an AggregateError, and on the success path it propagates on its own.
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
    rethrowAfterDeletingRawArtifact(fsApi, artifactPath, error);
  }

  let maskedScreenshot: ArtifactBytes;
  try {
    maskedScreenshot = mask(screenshot, rects, windowWidth);
  } catch (error) {
    rethrowAfterDeletingRawArtifact(fsApi, artifactPath, error);
  }

  // eslint-disable-next-line security/detect-non-literal-fs-filename
  fsApi.rmSync(artifactPath, { force: true });
  return maskedScreenshot;
}
