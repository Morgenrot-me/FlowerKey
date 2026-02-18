<!--
  花钥 Popup 主组件
  提供快速密码生成界面：输入区分代号 → 生成密码 → 复制
-->
<template>
  <div class="w-80 p-4 bg-white">
    <h1 class="text-lg font-bold text-center mb-3">🔑 花钥</h1>

    <!-- 未设置状态 -->
    <SetupForm v-if="!mainStore.isSetup" @done="onSetupDone" />

    <!-- 锁定状态 -->
    <UnlockForm v-else-if="!mainStore.isUnlocked" @unlocked="onUnlocked" />

    <!-- 已解锁：密码生成 -->
    <div v-else>
      <div class="space-y-3">
        <input
          v-model="codename"
          placeholder="输入区分代号"
          class="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
          @keyup.enter="generate"
        />
        <div class="flex gap-2">
          <select v-model="charsetMode" class="flex-1 px-2 py-2 border rounded text-sm">
            <option value="alphanumeric">字母+数字</option>
            <option value="with_symbols">含特殊字符</option>
          </select>
          <select v-model.number="pwdLength" class="w-20 px-2 py-2 border rounded text-sm">
            <option :value="8">8位</option>
            <option :value="16">16位</option>
            <option :value="24">24位</option>
            <option :value="32">32位</option>
          </select>
        </div>
        <button
          @click="generate"
          :disabled="!codename.trim()"
          class="w-full py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
        >
          生成密码
        </button>
      </div>

      <!-- 生成结果 -->
      <div v-if="generatedPwd" class="mt-3 p-2 bg-gray-50 rounded">
        <div class="flex items-center justify-between">
          <code class="text-sm break-all">{{ generatedPwd }}</code>
          <button @click="copyPwd" class="ml-2 text-xs text-blue-500 hover:underline shrink-0">
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
      </div>

      <div class="mt-3 flex justify-between text-xs text-gray-400">
        <button @click="openSidePanel" class="hover:text-gray-600">管理面板</button>
        <button @click="mainStore.lock()" class="hover:text-gray-600">锁定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMainStore } from '../../ui/src/stores/main';
import type { CharsetMode } from '@flowerkey/core';
import SetupForm from '../../ui/src/components/SetupForm.vue';
import UnlockForm from '../../ui/src/components/UnlockForm.vue';

const mainStore = useMainStore();

const codename = ref('');
const charsetMode = ref<CharsetMode>('alphanumeric');
const pwdLength = ref(16);
const generatedPwd = ref('');
const copied = ref(false);

onMounted(() => mainStore.checkSetup());

async function generate() {
  if (!codename.value.trim()) return;
  generatedPwd.value = await mainStore.genPassword(codename.value, charsetMode.value, pwdLength.value);
}

async function copyPwd() {
  await navigator.clipboard.writeText(generatedPwd.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}

function openSidePanel() {
  chrome.runtime.sendMessage({ type: 'openSidePanel' });
}

function onSetupDone() {}
function onUnlocked() {}
</script>
