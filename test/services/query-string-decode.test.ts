import fs from 'fs';
import path from 'path';

import { parse } from 'query-string';

describe('query-string parse with the decode-uri-component 0.5.x override', () => {
  it('decodes a percent-encoded UTF-8 sequence', () => {
    expect(parse('a=%C3%A5b').a).toBe('åb');
  });

  it('keeps a malformed percent sequence instead of throwing', () => {
    expect(parse('c=%E0%A4%A').c).toBe('%E0%A4%A');
  });

  it('decodes a 4-byte UTF-8 sequence', () => {
    expect(parse('d=%F0%9F%98%80').d).toBe('😀');
  });

  it('decodes + as a space', () => {
    expect(parse('e=a+b').e).toBe('a b');
  });

  it('resolves decode-uri-component >=0.5.1 <0.6.0 from query-string', () => {
    const queryStringEntry = require.resolve('query-string');
    const decodeEntry = require.resolve('decode-uri-component', {
      paths: [path.dirname(queryStringEntry)],
    });
    // eslint-disable-next-line security/detect-non-literal-fs-filename -- resolved entry
    const raw = fs.readFileSync(path.join(path.dirname(decodeEntry), 'package.json'), 'utf8');
    const { version } = JSON.parse(raw) as { version: string };
    const [major, minor, patch] = version.split('.').map(Number);
    expect(major).toBe(0);
    expect(minor).toBe(5);
    expect(patch).toBeGreaterThanOrEqual(1);
  });
});
