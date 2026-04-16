/**
 * 花钥 FlowerKey - 首屏直算流程测试
 * 覆盖正式模式与独立计算模式的核心行为，确保三端共享逻辑稳定。
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { runDirectPasswordFlow } from './direct-password.ts';

function createRuntime(overrides = {}) {
  const calls = {
    verify: 0,
    generate: 0,
    list: 0,
    create: 0,
    touch: 0,
    withWritableDbKey: 0,
  };

  const runtime = {
    calls,
    async getMasterData() {
      return {
        verifyHash: 'stored-hash',
        verifySalt: 'verify-salt',
        userSalt: 'FlowerKey',
        createdAt: 1,
      };
    },
    async verifyMasterPassword(masterPwd, verifySalt, verifyHash) {
      calls.verify++;
      return masterPwd === 'correct' && verifySalt === 'verify-salt' && verifyHash === 'stored-hash';
    },
    async generatePassword(masterPwd, userSalt, codename, mode, length) {
      calls.generate++;
      return `${masterPwd}|${userSalt}|${codename}|${mode}|${length}`;
    },
    async listPasswordEntries() {
      calls.list++;
      return [];
    },
    async createPasswordEntry(data) {
      calls.create++;
      return { id: 'created-entry', ...data, createdAt: 10, updatedAt: 10 };
    },
    async touchLastUsed(id) {
      calls.touch++;
      return id;
    },
    async withWritableDbKey(_masterPwd, _userSalt, run) {
      calls.withWritableDbKey++;
      return run();
    },
    ...overrides,
  };

  return runtime;
}

test('独立计算模式沿用 FlowerKey 固定盐', async () => {
  let usedSalt = '';
  const runtime = createRuntime({
    async generatePassword(masterPwd, userSalt, codename, mode, length) {
      usedSalt = userSalt;
      return `${masterPwd}|${userSalt}|${codename}|${mode}|${length}`;
    },
  });

  const result = await runDirectPasswordFlow({
    computeMode: 'independent',
    masterPwd: 'independent',
    codename: 'mail',
    mode: 'with_symbols',
    length: 24,
    runtime,
  });

  assert.equal(result.ok, true);
  assert.equal(usedSalt, 'FlowerKey');
});

test('正式模式在记忆密码错误时不给正式密码且不入库', async () => {
  const runtime = createRuntime();

  const result = await runDirectPasswordFlow({
    computeMode: 'formal',
    masterPwd: 'wrong',
    codename: 'github-main',
    mode: 'alphanumeric',
    length: 16,
    runtime,
  });

  assert.deepEqual(result, {
    ok: false,
    reason: 'invalid_master_password',
  });
  assert.equal(runtime.calls.verify, 1);
  assert.equal(runtime.calls.generate, 0);
  assert.equal(runtime.calls.create, 0);
  assert.equal(runtime.calls.touch, 0);
});


test('正式模式在新区分代号时创建临时标签条目并更新时间', async () => {
  const runtime = createRuntime();

  const result = await runDirectPasswordFlow({
    computeMode: 'formal',
    masterPwd: 'correct',
    codename: 'github-main',
    mode: 'with_symbols',
    length: 24,
    runtime,
  });

  assert.equal(result.ok, true);
  assert.equal(result.password, 'correct|FlowerKey|github-main|with_symbols|24');
  assert.equal(result.persisted, 'created');
  assert.equal(result.entryId, 'created-entry');
  assert.equal(runtime.calls.withWritableDbKey, 1);
  assert.equal(runtime.calls.create, 1);
  assert.equal(runtime.calls.touch, 1);
});

test('正式模式在已有区分代号时只更新最后使用时间', async () => {
  const runtime = createRuntime({
    async listPasswordEntries() {
      runtime.calls.list++;
      return [
        {
          id: 'existing-entry',
          type: 'password',
          codename: 'github-main',
          tags: ['常用'],
          folder: '',
          description: '',
          createdAt: 1,
          updatedAt: 1,
        },
      ];
    },
  });

  const result = await runDirectPasswordFlow({
    computeMode: 'formal',
    masterPwd: 'correct',
    codename: 'github-main',
    mode: 'alphanumeric',
    length: 16,
    runtime,
  });

  assert.equal(result.ok, true);
  assert.equal(result.persisted, 'touched');
  assert.equal(result.entryId, 'existing-entry');
  assert.equal(runtime.calls.create, 0);
  assert.equal(runtime.calls.touch, 1);
});
