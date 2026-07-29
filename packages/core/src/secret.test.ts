/** 花钥秘密载荷协议测试。 */
import { describe, expect, it } from 'vitest';
import { createSecretPayload, parseSecretPayload, serializeSecretPayload } from './secret.js';

describe('FK-SECRET-1', () => {
  it('round-trips every sensitive field', () => {
    const payload = createSecretPayload({
      kind: 'token', title: '生产 API', content: 'sk-secret', username: '团队账号',
      tags: ['工作', '生产'], folder: '公司', description: '仅限管理员',
    });
    expect(parseSecretPayload(serializeSecretPayload(payload))).toEqual(payload);
  });

  it('rejects unversioned and malformed content', () => {
    expect(parseSecretPayload('{"content":"secret"}')).toBeNull();
    expect(parseSecretPayload('not-json')).toBeNull();
    expect(parseSecretPayload('{"format":"FK-SECRET-1","kind":"unknown","content":"x"}')).toBeNull();
    expect(parseSecretPayload('{"format":"FK-SECRET-1","kind":"text","content":"x","title":7}')).toBeNull();
    expect(parseSecretPayload('{"format":"FK-SECRET-1","kind":"text","content":"x","tags":["ok",7]}')).toBeNull();
  });
});
