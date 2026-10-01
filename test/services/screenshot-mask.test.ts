import {
  elementFramesFromAttributes,
  maskPngRegions,
  SCREENSHOT_MASK_RGBA,
  type MaskablePng,
} from '../../e2e/utils/mask-png';

function createPng(width: number, height: number, fill = 0): MaskablePng {
  const data = new Uint8Array(width * height * 4);
  data.fill(fill);
  return { width, height, data };
}

function pixelAt(png: MaskablePng, x: number, y: number): number[] {
  const offset = (y * png.width + x) * 4;
  return Array.from(png.data.slice(offset, offset + 4));
}

describe('screenshot masking', () => {
  it('fills scaled regions with the exported opaque mask color', () => {
    const png = createPng(4, 4);

    maskPngRegions(png, [{ x: 0.5, y: 0.5, width: 1, height: 1 }], 2);

    expect(pixelAt(png, 0, 0)).toEqual([0, 0, 0, 0]);
    expect(pixelAt(png, 1, 1)).toEqual(Object.values(SCREENSHOT_MASK_RGBA));
    expect(pixelAt(png, 2, 2)).toEqual(Object.values(SCREENSHOT_MASK_RGBA));
    expect(pixelAt(png, 3, 3)).toEqual([0, 0, 0, 0]);
  });

  it('clamps rounded edges and ignores empty or negative regions', () => {
    const png = createPng(3, 2, 7);

    maskPngRegions(
      png,
      [
        { x: -0.4, y: -0.4, width: 1, height: 1 },
        { x: 1, y: 1, width: 0, height: 1 },
        { x: 1, y: 1, width: 1, height: -1 },
        { x: 10, y: 10, width: 1, height: 1 },
      ],
      2,
    );

    expect(pixelAt(png, 0, 0)).toEqual(Object.values(SCREENSHOT_MASK_RGBA));
    expect(pixelAt(png, 1, 1)).toEqual(Object.values(SCREENSHOT_MASK_RGBA));
    expect(pixelAt(png, 2, 1)).toEqual([7, 7, 7, 7]);
  });

  it('extracts direct, array and wrapped Detox frames with visible-frame fallback', () => {
    const frame = { x: 1, y: 2, width: 3, height: 4 };
    const visibleFrame = { x: 5, y: 6, width: 7, height: 8 };

    expect(elementFramesFromAttributes({ frame }, 'direct')).toEqual([frame]);
    expect(elementFramesFromAttributes([{ visibleFrame }], 'array')).toEqual([visibleFrame]);
    expect(
      elementFramesFromAttributes({ elements: [{ frame }, { visibleFrame }] }, 'wrapped'),
    ).toEqual([frame, visibleFrame]);
  });

  it('fails loudly when Detox attributes have no usable frame', () => {
    expect(() => elementFramesFromAttributes({ identifier: 'seed' }, 'seed')).toThrow(
      'seed element 0 returned attributes without a frame or visibleFrame',
    );
    expect(() => elementFramesFromAttributes({ elements: [] }, 'seed')).toThrow(
      'seed returned no element attributes',
    );
  });
});
