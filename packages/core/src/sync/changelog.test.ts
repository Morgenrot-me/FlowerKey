/**
 * 花钥 FlowerKey - 同步变更日志测试
 * 覆盖 oplog 序列化格式，避免同步传输结构回归
 */
import { describe, expect, it } from 'vitest';
import { deserializeOpLog, serializeOpLog, type OpLogEntry } from './changelog.js';

describe('changelog', () => {
  it('round-trips oplog entries with payloads', () => {
    const logs: OpLogEntry[] = [
      {
        entryId: 'entry-1',
        entryType: 'entry',
        operation: 'create',
        timestamp: 1000,
        deviceId: 'device-a',
        payload: {
          id: 'entry-1',
          type: 'password',
          codename: 'github',
          tags: ['work'],
          folder: '',
          description: '',
          createdAt: 1000,
          updatedAt: 1000,
        },
      },
      {
        entryId: 'entry-2',
        entryType: 'entry',
        operation: 'delete',
        timestamp: 2000,
        deviceId: 'device-b',
      },
    ];

    expect(deserializeOpLog(serializeOpLog(logs))).toEqual(logs);
  });

  it('surfaces invalid oplog JSON from JSON.parse', () => {
    expect(() => deserializeOpLog('{bad json')).toThrow(SyntaxError);
  });
});
