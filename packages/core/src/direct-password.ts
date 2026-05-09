/**
 * 花钥 FlowerKey - 首屏直算共享逻辑
 * 统一处理正式模式与独立计算模式的密码生成、记忆密码校验。
 * 生成与落库分离：只有用户主动复制时才调用 savePasswordEntry 保存。
 */

import type { CharsetMode, Entry, MasterPasswordData } from './models.js';

export type DirectComputeMode = 'formal' | 'independent';

export interface DirectPasswordRuntime {
  getMasterData(): Promise<MasterPasswordData | undefined | null>;
  verifyMasterPassword(masterPwd: string, verifySalt: string, storedHash: string): Promise<boolean>;
  generatePassword(masterPwd: string, userSalt: string, codename: string, mode: CharsetMode, length: number): Promise<string>;
  listPasswordEntries(): Promise<Entry[]>;
  createPasswordEntry(data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entry>;
  touchLastUsed(id: string): Promise<void>;
  withWritableDbKey<T>(masterPwd: string, userSalt: string, run: () => Promise<T>): Promise<T>;
}

export interface DirectPasswordInput {
  computeMode: DirectComputeMode;
  masterPwd: string;
  codename: string;
  mode?: CharsetMode;
  length?: number;
  url?: string;
  runtime: DirectPasswordRuntime;
}

export type DirectPasswordResult =
  | { ok: false; reason: 'invalid_master_password' | 'not_initialized' }
  | {
    ok: true;
    password: string;
    entryId?: string;
    persisted?: 'touched';
  };

const DEFAULT_USER_SALT = 'FlowerKey';
const DEFAULT_LENGTH = 16;
const DEFAULT_MODE: CharsetMode = 'alphanumeric';

function normalizeCodename(codename: string): string {
  return codename.trim();
}

export async function runDirectPasswordFlow(input: DirectPasswordInput): Promise<DirectPasswordResult> {
  const codename = normalizeCodename(input.codename);
  const mode = input.mode ?? DEFAULT_MODE;
  const length = input.length ?? DEFAULT_LENGTH;
  const masterData = await input.runtime.getMasterData();
  const userSalt = masterData?.userSalt || DEFAULT_USER_SALT;

  if (input.computeMode === 'independent') {
    return {
      ok: true,
      password: await input.runtime.generatePassword(input.masterPwd, userSalt, codename, mode, length),
    };
  }

  if (!masterData) {
    return { ok: false, reason: 'not_initialized' };
  }

  const verified = await input.runtime.verifyMasterPassword(
    input.masterPwd,
    masterData.verifySalt,
    masterData.verifyHash,
  );
  if (!verified) {
    return { ok: false, reason: 'invalid_master_password' };
  }

  const password = await input.runtime.generatePassword(input.masterPwd, userSalt, codename, mode, length);
  return input.runtime.withWritableDbKey(input.masterPwd, userSalt, async () => {
    const existing = (await input.runtime.listPasswordEntries())
      .find((entry) => entry.codename?.trim() === codename);

    if (existing?.id) {
      await input.runtime.touchLastUsed(existing.id);
      return {
        ok: true,
        password,
        entryId: existing.id,
        persisted: 'touched',
      } satisfies DirectPasswordResult;
    }

    return { ok: true, password };
  });
}

/** 用户主动复制时落库：已存在则更新最近使用，不存在则创建临时条目 */
export async function savePasswordEntry(input: {
  masterPwd: string;
  codename: string;
  mode: CharsetMode;
  length: number;
  url?: string;
  runtime: DirectPasswordRuntime;
}): Promise<{ entryId: string; created: boolean }> {
  const codename = normalizeCodename(input.codename);
  const masterData = await input.runtime.getMasterData();
  const userSalt = masterData?.userSalt || DEFAULT_USER_SALT;

  return input.runtime.withWritableDbKey(input.masterPwd, userSalt, async () => {
    const existing = (await input.runtime.listPasswordEntries())
      .find((entry) => entry.codename?.trim() === codename);

    if (existing?.id) {
      await input.runtime.touchLastUsed(existing.id);
      return { entryId: existing.id, created: false };
    }

    const created = await input.runtime.createPasswordEntry({
      type: 'password',
      codename,
      charsetMode: input.mode,
      passwordLength: input.length,
      tags: ['临时'],
      folder: '',
      description: '',
      ...(input.url ? { url: input.url } : {}),
    });
    await input.runtime.touchLastUsed(created.id);
    return { entryId: created.id, created: true };
  });
}
