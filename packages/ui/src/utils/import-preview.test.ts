/**
 * 花钥 - 导入预览工具测试
 * 覆盖页面层统计导入条数时的容错行为。
 */
import { describe, expect, it } from 'vitest';
import { getImportEntryCount } from './import-preview';

describe('getImportEntryCount', () => {
  it('returns the entries count for valid backup JSON', () => {
    expect(getImportEntryCount('{"entries":[{"id":"1"},{"id":"2"}]}')).toBe(2);
  });

  it('returns zero when entries is missing', () => {
    expect(getImportEntryCount('{"version":1}')).toBe(0);
  });

  it('returns zero instead of throwing for invalid JSON', () => {
    expect(getImportEntryCount('{invalid')).toBe(0);
  });
});
