/**
 * 花钥 FlowerKey - 测试环境初始化
 * 补齐 IndexedDB、Web Crypto 和 base64 API，保证 Node 环境可测试浏览器代码
 */
import 'fake-indexeddb/auto';
import { webcrypto } from 'node:crypto';

if (!globalThis.crypto) {
  Object.defineProperty(globalThis, 'crypto', {
    value: webcrypto,
    configurable: true,
  });
}

if (!globalThis.btoa) {
  Object.defineProperty(globalThis, 'btoa', {
    value: (value: string) => Buffer.from(value, 'binary').toString('base64'),
    configurable: true,
  });
}

if (!globalThis.atob) {
  Object.defineProperty(globalThis, 'atob', {
    value: (value: string) => Buffer.from(value, 'base64').toString('binary'),
    configurable: true,
  });
}
