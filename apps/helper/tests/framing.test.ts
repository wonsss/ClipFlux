import { describe, expect, it } from 'vitest';
import { encodeNativeMessage, NativeMessageDecoder } from '../src/native-messaging/framing';

describe('native messaging framing', () => {
  it('encodes and decodes fragmented messages', () => {
    const encoded = encodeNativeMessage({ type: 'health_check' });
    const decoder = new NativeMessageDecoder();
    expect(decoder.push(encoded.subarray(0, 3))).toEqual([]);
    expect(decoder.push(encoded.subarray(3))).toEqual([{ type: 'health_check' }]);
  });
  it('decodes multiple messages', () => {
    const decoder = new NativeMessageDecoder();
    expect(decoder.push(Buffer.concat([encodeNativeMessage({ a: 1 }), encodeNativeMessage({ b: 2 })]))).toEqual([{ a: 1 }, { b: 2 }]);
  });
  it('rejects malformed length', () => {
    const decoder = new NativeMessageDecoder();
    const header = Buffer.alloc(4); header.writeUInt32LE(2 * 1024 * 1024);
    expect(() => decoder.push(header)).toThrow('Invalid native message length');
  });
  it('rejects invalid JSON', () => {
    const header = Buffer.alloc(4); header.writeUInt32LE(1);
    expect(() => new NativeMessageDecoder().push(Buffer.concat([header, Buffer.from('{')]))).toThrow('Invalid native message JSON');
  });
});
