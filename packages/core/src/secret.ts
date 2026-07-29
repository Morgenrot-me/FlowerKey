/**
 * 花钥秘密库载荷协议。
 * 所有用户可识别字段都封装进 content，再由数据层整体 AES-256-GCM 加密。
 */

export type SecretKind = 'text' | 'credential' | 'token' | 'key' | 'recovery';

export interface SecretPayload {
  format: 'FK-SECRET-1';
  kind: SecretKind;
  title: string;
  content: string;
  username: string;
  tags: string[];
  folder: string;
  description: string;
}

export function createSecretPayload(input: Partial<Omit<SecretPayload, 'format'>> = {}): SecretPayload {
  return {
    format: 'FK-SECRET-1',
    kind: input.kind ?? 'text',
    title: input.title ?? '',
    content: input.content ?? '',
    username: input.username ?? '',
    tags: [...(input.tags ?? [])],
    folder: input.folder ?? '',
    description: input.description ?? '',
  };
}

export function serializeSecretPayload(payload: SecretPayload): string {
  return JSON.stringify(payload);
}

export function parseSecretPayload(value: string | undefined): SecretPayload | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value) as Partial<SecretPayload>;
    const kinds: SecretKind[] = ['text', 'credential', 'token', 'key', 'recovery'];
    if (parsed.format !== 'FK-SECRET-1' || typeof parsed.content !== 'string' || !kinds.includes(parsed.kind as SecretKind)) return null;
    const stringFields: Array<keyof Pick<SecretPayload, 'title' | 'username' | 'folder' | 'description'>> = ['title', 'username', 'folder', 'description'];
    if (stringFields.some(field => parsed[field] !== undefined && typeof parsed[field] !== 'string')) return null;
    if (parsed.tags !== undefined && (!Array.isArray(parsed.tags) || parsed.tags.some(tag => typeof tag !== 'string'))) return null;
    return createSecretPayload(parsed as Partial<Omit<SecretPayload, 'format'>>);
  } catch { return null; }
}
