<!--
  花钥 Popup - 锁定态首屏与确定性密码快速生成
-->
<template>
  <div class="w-80 bg-white dark:bg-gray-900 dark:text-gray-100">
    <div class="px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between">
      <h1 class="text-sm font-bold flex items-center gap-1"><img src="@ui/assets/key.png" class="w-4 h-4 object-contain" /> 花钥</h1>
      <div class="flex gap-3 text-xs text-gray-400">
        <button @click="openSidePanel" class="hover:text-gray-600 dark:hover:text-gray-200">管理面板</button>
      </div>
    </div>

    <div class="p-4">
      <Transition name="fade" mode="out-in">
        <div v-if="mainStore.hasUnsupportedMasterData" class="p-3 text-xs text-red-700 dark:text-red-300 space-y-1">
          <p class="font-medium">检测到发布前或损坏的花钥数据</p>
          <p>为避免覆盖原配置，请先清除本地开发数据，再重新打开花钥。</p>
        </div>
        <OnboardingForm v-else-if="!mainStore.isSetup && !showSetup" @done="showSetup = true" />
        <SetupForm v-else-if="!mainStore.isSetup" @done="onSetupDone" />

        <UnlockForm v-else-if="!mainStore.isUnlocked" @unlocked="onUnlocked" />

        <!-- 已解锁：密码生成模式 -->
        <div v-else class="space-y-3">
          <div v-if="!codename && !generatedPwd" class="rounded-2xl border border-blue-200/70 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 space-y-1.5 leading-relaxed">
            <p class="font-medium text-blue-800 dark:text-blue-200">快速生成</p>
            <p>输入一个区分代号，例如 微信、支付宝或 GitHub。</p>
            <p>点击复制按钮自动保存，直接回到网站粘贴即可。</p>
          </div>
          <input v-model="codename" placeholder="输入区分代号" class="input" @keyup.enter="generate" />
          <p class="text-[10px] text-gray-400 dark:text-gray-500">区分代号中的英文字母不区分大小写。</p>
          <div class="flex gap-2">
            <select v-model="charsetMode" class="flex-1 px-2 py-2 border rounded text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
              <option value="alphanumeric">字母+数字</option>
              <option value="with_symbols">含特殊字符</option>
            </select>
            <select v-model.number="pwdLength" class="w-20 px-2 py-2 border rounded text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
              <option :value="8">8位（旧系统）</option>
              <option :value="16">16位（默认）</option>
              <option :value="32">32位</option>
            </select>
          </div>
          <div v-if="generatedPwd" class="p-2 bg-gray-50 dark:bg-gray-800 rounded flex items-center justify-between">
            <code class="text-sm break-all">{{ generatedPwd.length <= 10 ? generatedPwd : generatedPwd.slice(0,5) + '•••••' + generatedPwd.slice(-5) }}</code>
            <button @click="copyPwd" class="ml-2 text-xs text-blue-500 hover:underline shrink-0">
              {{ copied ? '已复制' : '复制' }}
            </button>
          </div>
          <button @click="mainStore.lock()" class="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">锁定</button>
        </div>
      </Transition>
    </div>
    <Toast :visible="toast.visible.value" :message="toast.message.value" :type="toast.type.value" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useMainStore } from '@ui/stores/main';
import { useToast } from '@ui/composables/useToast';
import { db, normalizeCodename, type CharsetMode } from '@flowerkey/core';
import OnboardingForm from '@ui/components/OnboardingForm.vue';
import SetupForm from '@ui/components/SetupForm.vue';
import UnlockForm from '@ui/components/UnlockForm.vue';
import Toast from '@ui/components/Toast.vue';
import { syncBackgroundLockState } from '../src/state-sync';

const mainStore = useMainStore();
const toast = useToast();
const showSetup = ref(false);

// 密码生成
const codename = ref('');
const charsetMode = ref<CharsetMode>('alphanumeric');
const pwdLength = ref(16);
const generatedPwd = ref('');
const copied = ref(false);
let generationRequestId = 0;

watch([codename, charsetMode, pwdLength], async ([c]) => {
  const requestId = ++generationRequestId;
  if (mainStore.isUnlocked && (c as string).trim()) {
    const res = await chrome.runtime.sendMessage({ type: 'generatePassword', codename: c, mode: charsetMode.value, length: pwdLength.value });
    if (requestId !== generationRequestId) return;
    if (res?.mode) charsetMode.value = res.mode;
    if (res?.length) pwdLength.value = res.length;
    generatedPwd.value = res?.password || '';
  } else {
    generatedPwd.value = '';
  }
});

onMounted(async () => {
  await mainStore.checkSetup();
  const state = await chrome.runtime.sendMessage({ type: 'getUnlockState' });
  if (state?.isUnlocked) {
    const restored = await chrome.runtime.sendMessage({ type: 'restoreDbKey' });
    if (restored?.ok) {
      mainStore.userSalt = restored.userSalt;
      mainStore.isUnlocked = true;
    }
  }
});

async function syncBackgroundLock() {
  await syncBackgroundLockState(chrome.runtime.sendMessage, {
    isUnlocked: mainStore.isUnlocked,
    masterPwd: mainStore.masterPwd,
    userSalt: mainStore.userSalt,
  });
}

watch(() => mainStore.isUnlocked, async () => {
  await syncBackgroundLock();
});

function onSetupDone() {}

async function onUnlocked() {
  await syncBackgroundLock();
}

async function generate() {
  if (!codename.value.trim()) return;
  const requestId = ++generationRequestId;
  const res = await chrome.runtime.sendMessage({
    type: 'generatePassword',
    codename: codename.value,
    mode: charsetMode.value,
    length: pwdLength.value,
  });
  if (requestId !== generationRequestId) return;
  if (!res?.password) {
    toast.show(res?.error || '密码生成失败', 'error');
    return;
  }
  if (res.mode) charsetMode.value = res.mode;
  if (res.length) pwdLength.value = res.length;
  generatedPwd.value = res.password;
  await copyPwd();
}

async function copyPwd() {
  if (!generatedPwd.value) return;
  await navigator.clipboard.writeText(generatedPwd.value);
  const all = await db.getEntriesByType('password');
  const normalizedCodename = normalizeCodename(codename.value);
  const matched = all.find(
    e => e.codename && normalizeCodename(e.codename) === normalizedCodename,
  );
  if (matched?.id) {
    await db.touchLastUsed(matched.id);
  } else {
    await db.createEntry({
      type: 'password',
      codename: codename.value.trim(),
      charsetMode: charsetMode.value,
      passwordLength: pwdLength.value,
      tags: ['临时'],
      folder: '',
      description: '',
    });
  }
  copied.value = true;
  toast.show('密码已复制到剪贴板', 'success');
  setTimeout(() => (copied.value = false), 1500);
}

async function openSidePanel() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
  window.close();
}
</script>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
