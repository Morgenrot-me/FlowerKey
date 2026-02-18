<!--
  花钥 - 设置页
  WebDAV 配置 + 同步操作
-->
<template>
  <div class="p-4 space-y-4 text-xs">
    <h2 class="text-sm font-bold">设置</h2>

    <!-- WebDAV 配置 -->
    <div class="space-y-2">
      <p class="font-medium text-gray-700">WebDAV 同步</p>
      <input v-model="form.url" placeholder="服务器地址（如 https://dav.jianguoyun.com/dav/）" class="input" />
      <input v-model="form.username" placeholder="用户名" class="input" />
      <input v-model="form.password" type="password" placeholder="密码" class="input" />
      <input v-model="form.basePath" placeholder="同步目录（默认 /FlowerKey）" class="input" />
      <button @click="saveConfig" class="w-full py-1.5 bg-gray-800 text-white rounded hover:bg-gray-700">
        保存配置
      </button>
    </div>

    <!-- 同步操作 -->
    <div class="space-y-2">
      <button
        @click="syncStore.sync()"
        :disabled="syncStore.syncing || !syncStore.config"
        class="w-full py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {{ syncStore.syncing ? '同步中...' : '立即同步' }}
      </button>
      <p v-if="syncStore.lastResult" class="text-gray-500">
        上次同步：推送 {{ syncStore.lastResult.pushed }} 条，拉取 {{ syncStore.lastResult.pulled }} 条
      </p>
      <p v-if="syncStore.error" class="text-red-500">{{ syncStore.error }}</p>
    </div>

    <!-- 危险操作 -->
    <div class="border-t pt-3 space-y-2">
      <p class="font-medium text-gray-700">危险操作</p>
      <button @click="confirmClear" class="w-full py-1.5 border border-red-300 text-red-500 rounded hover:bg-red-50">
        清除本地数据
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSyncStore } from '../stores/sync';
import type { WebDAVConfig } from '@flowerkey/core';

const syncStore = useSyncStore();

const form = ref<WebDAVConfig>({ url: '', username: '', password: '', basePath: '/FlowerKey' });

onMounted(async () => {
  await syncStore.loadConfig();
  if (syncStore.config) Object.assign(form.value, syncStore.config);
});

async function saveConfig() {
  if (!form.value.url || !form.value.username) return;
  await syncStore.saveConfig({ ...form.value });
}

function confirmClear() {
  if (confirm('确定要清除所有本地数据吗？此操作不可恢复。')) {
    indexedDB.deleteDatabase('FlowerKeyDB');
    location.reload();
  }
}
</script>

<style scoped>
.input { @apply w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400; }
</style>
