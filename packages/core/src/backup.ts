/** 花钥加密备份封装。旧明文 JSON 仅保留导入兼容。 */
import { base64ToBytes, bytesToBase64, decrypt, encrypt } from './crypto.js';

interface EncryptedBackup {
  format: 'FK-BACKUP-1';
  ciphertext: string;
}

export async function encryptBackup(plainJson: string, key: CryptoKey): Promise<string> {
  const encrypted = await encrypt(plainJson, key);
  const envelope: EncryptedBackup = { format: 'FK-BACKUP-1', ciphertext: bytesToBase64(new Uint8Array(encrypted)) };
  return JSON.stringify(envelope);
}

export async function openBackup(input: string, key: CryptoKey): Promise<string> {
  let parsed: Partial<EncryptedBackup>;
  try { parsed = JSON.parse(input) as Partial<EncryptedBackup>; } catch { return input; }
  if (parsed.format !== 'FK-BACKUP-1') return input;
  if (typeof parsed.ciphertext !== 'string') throw new Error('加密备份格式错误');
  const bytes = base64ToBytes(parsed.ciphertext);
  return decrypt(bytes.buffer as ArrayBuffer, key);
}
