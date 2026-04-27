<!--
  花钥 - 锁定态首屏表单
  默认提供正式密码直算，并保留登入数据库与恢复码解锁入口。
-->
<template>
  <div class="space-y-3">
    <div class="space-y-1 text-center">
      <p class="text-sm text-gray-700 dark:text-gray-300">输入记忆密码和区分代号即可计算密码</p>
      <p class="text-[10px] text-gray-400 dark:text-gray-500">正式模式会校验并保存；独立模式仅复制</p>
    </div>

    <div v-if="computeMode === 'independent'" class="rounded-2xl border border-amber-200/70 bg-amber-50/70 dark:border-amber-900/50 dark:bg-amber-900/20 px-3 py-2 text-xs text-amber-700 dark:text-amber-300 space-y-1 leading-relaxed">
      <p class="font-medium text-amber-800 dark:text-amber-200">独立计算模式</p>
      <p>沿用 FlowerKey 固定盐，只生成可复制结果，不会保存到数据库。</p>
    </div>

    <input
      v-model="pwd"
      type="password"
      placeholder="记忆密码"
      class="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
    />
    <input
      v-model="codename"
      type="text"
      placeholder="区分代号，例如 github-main"
      class="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
    />
    <div class="flex gap-2">
      <select v-model="charsetMode" class="flex-1 px-3 py-2 border rounded text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
        <option value="alphanumeric">字母+数字</option>
        <option value="with_symbols">含特殊字符</option>
      </select>
      <select v-model.number="pwdLength" class="w-24 px-3 py-2 border rounded text-sm bg-white text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
        <option :value="8">8位</option>
        <option :value="16">16位</option>
        <option :value="24">24位</option>
        <option :value="32">32位</option>
      </select>
    </div>

    <p v-if="error" class="text-xs text-red-500">{{ error }}</p>
    <p v-else-if="notice" class="text-xs text-blue-600 dark:text-blue-300">{{ notice }}</p>
    <p v-else-if="computeLoading" class="text-xs text-gray-400 dark:text-gray-500">计算中...</p>

    <div v-if="generatedPwd" class="p-2.5 bg-gray-50 dark:bg-gray-800 rounded-xl flex items-center justify-between gap-2">
      <code class="text-sm break-all text-gray-700 dark:text-gray-200">{{ generatedPwd }}</code>
      <button @click="copyPwd" class="shrink-0 text-xs text-blue-500 hover:underline">
        {{ copied ? '已复制' : '复制' }}
      </button>
    </div>

    <button
      v-if="showIndependentAction"
      @click="computeMode = 'independent'"
      :disabled="actionLoading"
      class="w-full py-2 border border-amber-300 text-amber-700 rounded text-sm hover:bg-amber-50 disabled:opacity-50 dark:border-amber-700 dark:text-amber-300 dark:hover:bg-amber-900/20"
    >
      改用独立计算模式
    </button>

    <button
      v-else-if="computeMode === 'independent'"
      @click="switchToFormal"
      :disabled="actionLoading"
      class="w-full py-2 border border-blue-200 text-blue-600 rounded text-sm hover:bg-blue-50 disabled:opacity-50 dark:border-blue-800 dark:text-blue-300 dark:hover:bg-blue-900/20"
    >
      返回正式模式
    </button>

    <button
      @click="submitUnlock"
      :disabled="actionLoading"
      class="w-full py-2 border border-gray-200 text-gray-600 rounded text-sm hover:bg-gray-50 disabled:opacity-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
    >
      {{ actionLoading ? '处理中...' : '登入数据库' }}
    </button>

    <button @click="showRecovery = !showRecovery" class="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
      忘记密码？使用恢复码
    </button>
    <div v-if="showRecovery" class="space-y-2">
      <input
        v-model="recoveryCode"
        type="text"
        placeholder="粘贴恢复码"
        class="w-full px-3 py-2 border rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
      />
      <button
        @click="submitRecovery"
        :disabled="actionLoading"
        class="w-full py-2 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 disabled:opacity-50"
      >
        {{ actionLoading ? '验证中...' : '用恢复码解锁' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import type { CharsetMode, DirectComputeMode } from '@flowerkey/core';
import { useMainStore } from '../stores/main';

const emit = defineEmits<{ unlocked: [] }>();
const mainStore = useMainStore();

const pwd = ref('');
const codename = ref('');
const charsetMode = ref<CharsetMode>('alphanumeric');
const pwdLength = ref(16);
const computeMode = ref<DirectComputeMode>('formal');
const generatedPwd = ref('');
const notice = ref('');
const error = ref('');
const actionLoading = ref(false);
const computeLoading = ref(false);
const copied = ref(false);
const showRecovery = ref(false);
const recoveryCode = ref('');
const showIndependentAction = ref(false);
let computeTimer: ReturnType<typeof setTimeout> | undefined;
let computeSeq = 0;
let lastComputedKey = '';

function resetFeedback() {
  error.value = '';
  notice.value = '';
}

function resetResult() {
  generatedPwd.value = '';
  copied.value = false;
}

async function submitUnlock() {
  resetFeedback();
  actionLoading.value = true;
  try {
    const ok = await mainStore.unlock(pwd.value);
    if (ok) emit('unlocked');
    else error.value = '记忆密码错误，无法登入数据库';
  } finally {
    actionLoading.value = false;
  }
}

async function submitRecovery() {
  resetFeedback();
  actionLoading.value = true;
  try {
    const ok = await mainStore.recoverWithCode(recoveryCode.value.trim());
    if (ok) emit('unlocked');
    else error.value = '恢复码错误或未设置恢复码';
  } finally {
    actionLoading.value = false;
  }
}

function currentComputeKey(targetMode = computeMode.value) {
  return [targetMode, pwd.value, codename.value.trim(), charsetMode.value, pwdLength.value].join('\0');
}

function scheduleCompute() {
  if (computeTimer) clearTimeout(computeTimer);
  computeSeq++;
  resetFeedback();
  if (!pwd.value.trim() || !codename.value.trim()) {
    resetResult();
    lastComputedKey = '';
    computeLoading.value = false;
    return;
  }
  computeTimer = setTimeout(() => {
    submitCompute();
  }, 400);
}

async function submitCompute(nextMode?: DirectComputeMode) {
  const targetMode = nextMode ?? computeMode.value;
  computeMode.value = targetMode;
  const key = currentComputeKey(targetMode);
  if (key === lastComputedKey && generatedPwd.value) return;

  resetFeedback();
  resetResult();
  showIndependentAction.value = false;

  if (!pwd.value.trim()) return;
  if (!codename.value.trim()) return;

  const seq = ++computeSeq;
  computeLoading.value = true;
  try {
    const result = await mainStore.runDirectPassword(
      targetMode,
      pwd.value,
      codename.value,
      charsetMode.value,
      pwdLength.value,
    );
    if (seq !== computeSeq) return;
    if (!result.ok) {
      if (result.reason === 'invalid_master_password') {
        error.value = '记忆密码不正确，不能生成正式密码';
        showIndependentAction.value = targetMode === 'formal';
        return;
      }
      error.value = '请先完成首次设置';
      return;
    }

    lastComputedKey = key;
    generatedPwd.value = result.password;
    if (targetMode === 'independent') {
      notice.value = '独立计算模式不会保存到数据库，也不会自动填充。';
      return;
    }
    if (result.persisted === 'created') {
      notice.value = '正式密码已生成，并已保存到临时标签。';
      return;
    }
    if (result.persisted === 'touched') {
      notice.value = '正式密码已生成，并已更新最近使用时间。';
      return;
    }
    notice.value = '正式密码已生成。';
  } finally {
    if (seq === computeSeq) computeLoading.value = false;
  }
}

function switchToFormal() {
  computeMode.value = 'formal';
  showIndependentAction.value = false;
  resetFeedback();
  resetResult();
  lastComputedKey = '';
  scheduleCompute();
}

watch([pwd, codename, charsetMode, pwdLength, computeMode], scheduleCompute);

async function copyPwd() {
  if (!generatedPwd.value) return;
  await navigator.clipboard.writeText(generatedPwd.value);
  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1500);
}
</script>
