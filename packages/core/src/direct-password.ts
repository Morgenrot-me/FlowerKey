/**
 * 花钥 FlowerKey - 首屏直算共享逻辑
 * 统一处理正式模式与独立计算模式的密码生成、记忆密码校验。
 * 生成与落库分离：只有用户主动复制时才调用 savePasswordEntry 保存。
 */

import type { CharsetMode, Entry, MasterPasswordData } from './models.js';
import { normalizeCodename } from './crypto.js';

export type DirectComputeMode = 'formal' | 'independent';

export interface DirectPasswordRuntime {
  getMasterData(): Promise<MasterPasswordData | undefined | null>;
  openMasterPasswordData(masterPwd: string, data: MasterPasswordData): Promise<string | null>;
  generatePassword(masterPwd: string, userSalt: string, codename: string, mode: CharsetMode, length: number): Promise<string>;
  listPasswordEntries(): Promise<Entry[]>;
  createPasswordEntry(data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>): Promise<Entry>;
  touchLastUsed(id: string): Promise<void>;
  withWritableDbKey<T>(masterPwd: string, userSalt: string, run: () => Promise<T>): Promise<T>;
}

export interface DirectPasswordInput {
  computeMode: DirectComputeMode;
  masterPwd: string;
  identitySecret?: string;
  codename: string;
  mode?: CharsetMode;
  length?: number;
  url?: string;
  runtime: DirectPasswordRuntime;
}

export type DirectPasswordResult =
  | {
    ok: false;
    reason: 'invalid_master_password' | 'not_initialized' | 'missing_identity_secret';
  }
  | {
    ok: true;
    password: string;
    entryId?: string;
    persisted?: 'touched';
  };

const DEFAULT_LENGTH = 16;
const DEFAULT_MODE: CharsetMode = 'alphanumeric';

function normalizeCodenameInput(codename: string): string {
  return codename.trim();
}

export async function runDirectPasswordFlow(input: DirectPasswordInput): Promise<DirectPasswordResult> {
  const codename = normalizeCodenameInput(input.codename);
  const mode = input.mode ?? DEFAULT_MODE;
  const length = input.length ?? DEFAULT_LENGTH;
  const masterData = await input.runtime.getMasterData();

  if (input.computeMode === 'independent') {
    const identitySecret = masterData
      ? await input.runtime.openMasterPasswordData(input.masterPwd, masterData)
      : input.identitySecret;
    if (!identitySecret) {
      return {
        ok: false,
        reason: masterData ? 'invalid_master_password' : 'missing_identity_secret',
      };
    }
    return {
      ok: true,
      password: await input.runtime.generatePassword(
        input.masterPwd,
        identitySecret,
        codename,
        mode,
        length,
      ),
    };
  }

  if (!masterData) {
    return { ok: false, reason: 'not_initialized' };
  }
  const identitySecret = await input.runtime.openMasterPasswordData(input.masterPwd, masterData);
  if (!identitySecret) {
    return { ok: false, reason: 'invalid_master_password' };
  }

  return input.runtime.withWritableDbKey(input.masterPwd, identitySecret, async () => {
    const normalizedCodename = normalizeCodename(codename);
    const existing = (await input.runtime.listPasswordEntries())
      .find((entry) => entry.codename && normalizeCodename(entry.codename) === normalizedCodename);
    const effectiveMode = existing?.charsetMode ?? mode;
    const effectiveLength = existing?.passwordLength ?? length;
    const password = await input.runtime.generatePassword(
      input.masterPwd,
      identitySecret,
      codename,
      effectiveMode,
      effectiveLength,
    );

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
  const codename = normalizeCodenameInput(input.codename);
  const masterData = await input.runtime.getMasterData();
  if (!masterData) throw new Error('设备尚未初始化，无法保存密码条目');
  const identitySecret = await input.runtime.openMasterPasswordData(input.masterPwd, masterData);
  if (!identitySecret) throw new Error('记忆密码错误，无法保存密码条目');

  return input.runtime.withWritableDbKey(input.masterPwd, identitySecret, async () => {
    const normalizedCodename = normalizeCodename(codename);
    const existing = (await input.runtime.listPasswordEntries())
      .find((entry) => entry.codename && normalizeCodename(entry.codename) === normalizedCodename);

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
