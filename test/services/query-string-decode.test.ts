import { parse } from 'query-string';

describe('deep-link query decoding through query-string with decode-uri-component 0.5.x', () => {
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
});
