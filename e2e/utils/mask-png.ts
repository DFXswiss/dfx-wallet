import { PNG } from 'pngjs';

export type ScreenshotMaskRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type MaskablePng = {
  width: number;
  height: number;
  data: Uint8Array;
};

export const SCREENSHOT_MASK_RGBA = { r: 255, g: 0, b: 255, a: 255 } as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readFrame(value: unknown, target: string): ScreenshotMaskRect {
  if (!isRecord(value)) {
    throw new Error(`${target} returned attributes without a frame or visibleFrame`);
  }

  const values = [value.x, value.y, value.width, value.height];
  if (
    !values.every(
      (coordinate) => typeof coordinate === 'number' && Number.isFinite(coordinate),
    )
  ) {
    throw new Error(`${target} returned an invalid frame`);
  }

  return {
    x: value.x as number,
    y: value.y as number,
    width: value.width as number,
    height: value.height as number,
  };
}

export function elementFramesFromAttributes(
  attributes: unknown,
  target: string,
): ScreenshotMaskRect[] {
  const entries = Array.isArray(attributes)
    ? attributes
    : isRecord(attributes) && 'elements' in attributes
      ? attributes.elements
      : [attributes];

  if (!Array.isArray(entries) || entries.length === 0) {
    throw new Error(`${target} returned no element attributes`);
  }

  return entries.map((entry, index) => {
    if (!isRecord(entry)) {
      throw new Error(`${target} returned invalid attributes for element ${index}`);
    }
    return readFrame(entry.frame ?? entry.visibleFrame, `${target} element ${index}`);
  });
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(Math.max(value, minimum), maximum);
}

export function maskPngRegions(
  png: MaskablePng,
  rects: readonly ScreenshotMaskRect[],
  pixelsPerPoint: number,
): void {
  if (!Number.isFinite(pixelsPerPoint) || pixelsPerPoint <= 0) {
    throw new Error('Screenshot pixels-per-point factor must be positive');
  }
  if (png.data.length < png.width * png.height * 4) {
    throw new Error('Screenshot pixel buffer is smaller than its dimensions');
  }

  for (const rect of rects) {
    if (
      ![rect.x, rect.y, rect.width, rect.height].every(Number.isFinite) ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      continue;
    }

    const startX = clamp(Math.floor(rect.x * pixelsPerPoint), 0, png.width);
    const startY = clamp(Math.floor(rect.y * pixelsPerPoint), 0, png.height);
    const endX = clamp(Math.ceil((rect.x + rect.width) * pixelsPerPoint), 0, png.width);
    const endY = clamp(Math.ceil((rect.y + rect.height) * pixelsPerPoint), 0, png.height);

    if (endX <= startX || endY <= startY) continue;

    for (let y = startY; y < endY; y += 1) {
      for (let x = startX; x < endX; x += 1) {
        const offset = (y * png.width + x) * 4;
        png.data[offset] = SCREENSHOT_MASK_RGBA.r;
        png.data[offset + 1] = SCREENSHOT_MASK_RGBA.g;
        png.data[offset + 2] = SCREENSHOT_MASK_RGBA.b;
        png.data[offset + 3] = SCREENSHOT_MASK_RGBA.a;
      }
    }
  }
}

export function maskPngBuffer(
  screenshot: Buffer,
  rects: readonly ScreenshotMaskRect[],
  windowWidth: number,
): Buffer {
  const png = PNG.sync.read(screenshot);
  maskPngRegions(png, rects, png.width / windowWidth);
  return PNG.sync.write(png);
}
