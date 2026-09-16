import { describe, expect, it } from 'vitest';
import { ExtensionMessageSchema } from '../src/messages';

describe('native message schemas', () => {
  it('accepts a structured health request', () => expect(ExtensionMessageSchema.safeParse({ type: 'health_check' }).success).toBe(true));
  it.each([
    { type: 'execute_command', command: 'rm' },
    { type: 'start_download', payload: { taskId: 'not-a-uuid', url: 'file:///tmp/a', videoId: 'bad', kind: 'video' } },
    { type: 'cancel_download', taskId: '../../../etc/passwd' },
  ])('rejects malformed or dangerous message %#', (message) => expect(ExtensionMessageSchema.safeParse(message).success).toBe(false));
});
