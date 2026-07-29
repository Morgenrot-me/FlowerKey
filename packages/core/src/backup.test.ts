/** FK-BACKUP-1 加密备份测试。 */
import { describe, expect, it } from 'vitest';
import { deriveDatabaseKey } from './crypto.js';
import { encryptBackup, openBackup } from './backup.js';

describe('FK-BACKUP-1', () => {
  it('encrypts and opens a backup with the database key', async () => {
    const key = await deriveDatabaseKey('master', 'identity');
    const plain = JSON.stringify({ entries: [{ type: 'secret', content: 'PRIVATE' }] });
    const backup = await encryptBackup(plain, key);
    expect(backup).not.toContain('PRIVATE');
    await expect(openBackup(backup, key)).resolves.toBe(plain);
  });

  it('keeps legacy plaintext JSON import-compatible', async () => {
    const key = await deriveDatabaseKey('master', 'identity');
    await expect(openBackup('{"version":1,"entries":[]}', key)).resolves.toBe('{"version":1,"entries":[]}');
  });
});
