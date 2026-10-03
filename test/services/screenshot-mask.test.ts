import { PNG } from 'pngjs';
import { maskArtifactInPlace } from '../../e2e/utils/mask-artifact';
import {
  elementFramesFromAttributes,
  maskPngBuffer,
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

function createFsApi(source: Buffer) {
  return {
    readFileSync: jest.fn((_path: string) => source),
    writeFileSync: jest.fn((_path: string, _data: Buffer) => undefined),
    rmSync: jest.fn((_path: string, _options: { force: true }) => undefined),
  };
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

  it('returns an encoded PNG with the requested region masked', () => {
    const source = new PNG({ width: 2, height: 2 });
    source.data.fill(0);
    const encoded = PNG.sync.write(source);

    const masked = maskPngBuffer(encoded, [{ x: 0, y: 0, width: 1, height: 1 }], 2);
    const decoded = PNG.sync.read(masked);

    expect(pixelAt(decoded, 0, 0)).toEqual(Object.values(SCREENSHOT_MASK_RGBA));
    expect(pixelAt(decoded, 1, 1)).toEqual([0, 0, 0, 0]);
    expect(PNG.sync.read(encoded).data.every((channel: number) => channel === 0)).toBe(true);
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

  it('overwrites a raw artifact with the masked buffer', () => {
    const source = Buffer.from('raw screenshot');
    const masked = Buffer.from('masked screenshot');
    const fsApi = createFsApi(source);
    const mask = jest.fn(() => masked);

    expect(maskArtifactInPlace('/tmp/artifact.png', [], 390, fsApi, mask)).toBe(masked);
    expect(mask).toHaveBeenCalledWith(source, [], 390);
    expect(fsApi.writeFileSync).toHaveBeenCalledWith('/tmp/artifact.png', masked);
    expect(fsApi.rmSync).not.toHaveBeenCalled();
  });

  it('removes the raw artifact and rethrows when masking fails', () => {
    const error = new Error('mask failed');
    const fsApi = createFsApi(Buffer.from('raw screenshot'));
    const mask = jest.fn(() => {
      throw error;
    });

    expect(() => maskArtifactInPlace('/tmp/artifact.png', [], 390, fsApi, mask)).toThrow(error);
    expect(fsApi.writeFileSync).not.toHaveBeenCalled();
    expect(fsApi.rmSync).toHaveBeenCalledWith('/tmp/artifact.png', { force: true });
  });

  it('removes the raw artifact and rethrows the original write failure', () => {
    const error = new Error('write failed');
    const fsApi = createFsApi(Buffer.from('raw screenshot'));
    fsApi.writeFileSync.mockImplementationOnce(() => {
      throw error;
    });

    expect(() =>
      maskArtifactInPlace('/tmp/artifact.png', [], 390, fsApi, (screenshot) => screenshot),
    ).toThrow(error);
    expect(fsApi.rmSync).toHaveBeenCalledWith('/tmp/artifact.png', { force: true });
  });
});
