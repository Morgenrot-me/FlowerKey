<!--
  花钥 - 设置页
  WebDAV 配置 + 同步操作 + 账户安全（恢复码/改密/导出导入）
-->
<template>
  <div class="p-4 space-y-4 text-xs">
    <h2 class="text-sm font-bold">设置</h2>

    <!-- 数据安全警告 -->
    <div v-if="!syncStore.config && !hasRecovery"
      class="p-2 bg-orange-50 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded text-orange-700 dark:text-orange-300">
      ⚠️ 未配置 WebDAV 同步且未生成恢复码。卸载插件将永久丢失所有数据，建议至少完成其中一项。
    </div>
    <div v-else-if="!syncStore.config"
      class="p-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded text-yellow-700 dark:text-yellow-400">
      未配置 WebDAV 同步，卸载插件将丢失数据。
    </div>

    <!-- WebDAV 配置 -->
    <div class="space-y-2">
      <p class="font-medium text-gray-700 dark:text-gray-300">WebDAV 同步</p>
      <input v-model="form.url" placeholder="服务器地址（如 https://dav.jianguoyun.com/dav/）" class="input" />
      <input v-model="form.username" placeholder="用户名" class="input" />
      <input v-model="form.password" type="password" placeholder="密码" class="input" />
      <input v-model="form.basePath" placeholder="同步目录（默认 /FlowerKey）" class="input" />
      <button @click="saveConfig" class="w-full py-1.5 bg-gray-800 text-white rounded hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500">
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
      <p v-if="syncStore.lastResult" class="text-gray-500 dark:text-gray-400">
        上次同步：推送 {{ syncStore.lastResult.pushed }} 条，拉取 {{ syncStore.lastResult.pulled }} 条
      </p>
      <p v-if="syncStore.error" class="text-red-500">{{ syncStore.error }}</p>
    </div>

    <!-- 账户安全 -->
    <div class="border-t pt-3 space-y-3">
      <p class="font-medium text-gray-700 dark:text-gray-300">账户安全</p>

      <!-- 方案一：恢复码 -->
      <div class="space-y-1">
        <p class="text-gray-500 dark:text-gray-400">恢复码可在忘记主密码时恢复账户，请妥善保管。</p>
        <button @click="handleGenerateRecovery" class="w-full py-1.5 border rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">
          生成新恢复码
        </button>
        <div v-if="recoveryCode" class="p-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded break-all font-mono select-all">
          {{ recoveryCode }}
          <p class="text-yellow-600 dark:text-yellow-400 mt-1 font-sans">请抄写或打印保存，关闭后不再显示。</p>
        </div>
      </div>

      <!-- 方案二：修改主密码 -->
      <div class="space-y-1">
        <button @click="showChangePwd = !showChangePwd" class="w-full py-1.5 border rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">
          修改主密码
        </button>
        <div v-if="showChangePwd" class="space-y-1">
          <input v-model="newPwd" type="password" placeholder="新主密码" class="input" />
          <input v-model="newPwdConfirm" type="password" placeholder="确认新主密码" class="input" />
          <button @click="handleChangePwd" :disabled="changingPwd" class="w-full py-1.5 bg-orange-500 text-white rounded hover:bg-orange-600 disabled:opacity-50">
            {{ changingPwd ? '处理中...' : '确认修改' }}
          </button>
          <p v-if="changePwdMsg" :class="changePwdError ? 'text-red-500' : 'text-green-600'">{{ changePwdMsg }}</p>
        </div>
      </div>

      <!-- 方案三：导出/导入 -->
      <div class="space-y-1">
        <p class="text-gray-500 dark:text-gray-400">导出明文备份，请妥善保管文件。</p>
        <div class="flex gap-2">
          <button @click="handleExport" class="flex-1 py-1.5 border rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">导出备份</button>
          <label class="flex-1 py-1.5 border rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 text-center cursor-pointer">
            导入备份
            <input type="file" accept=".json" class="hidden" @change="handleImport" />
          </label>
        </div>
        <p v-if="importMsg" class="text-green-600">{{ importMsg }}</p>
      </div>
    </div>

    <!-- 危险操作 -->
    <div class="border-t pt-3 space-y-2">
      <p class="font-medium text-gray-700 dark:text-gray-300">危险操作</p>
      <button @click="confirmClear" class="w-full py-1.5 border border-red-300 text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
        清除本地数据
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSyncStore } from '../stores/sync';
import { useMainStore } from '../stores/main';
import { db, type WebDAVConfig } from '@flowerkey/core';

const syncStore = useSyncStore();
const mainStore = useMainStore();

const form = ref<WebDAVConfig>({ url: '', username: '', password: '', basePath: '/FlowerKey' });
const hasRecovery = ref(false);

onMounted(async () => {
  await syncStore.loadConfig();
  if (syncStore.config) Object.assign(form.value, syncStore.config);
  const data = await db.getMasterData();
  hasRecovery.value = !!data?.encryptedMasterPwd;
});

async function saveConfig() {
  if (!form.value.url || !form.value.username) return;
  await syncStore.saveConfig({ ...form.value });
}

// 方案一：恢复码
const recoveryCode = ref('');
async function handleGenerateRecovery() {
  recoveryCode.value = await mainStore.generateRecovery();
  hasRecovery.value = true;
}

// 方案二：修改主密码
const showChangePwd = ref(false);
const newPwd = ref('');
const newPwdConfirm = ref('');
const changingPwd = ref(false);
const changePwdMsg = ref('');
const changePwdError = ref(false);

async function handleChangePwd() {
  if (!newPwd.value || newPwd.value !== newPwdConfirm.value) {
    changePwdMsg.value = '两次输入不一致'; changePwdError.value = true; return;
  }
  changingPwd.value = true; changePwdMsg.value = '';
  try {
    await mainStore.changeMasterPwd(newPwd.value);
    changePwdMsg.value = '修改成功'; changePwdError.value = false;
    newPwd.value = ''; newPwdConfirm.value = ''; showChangePwd.value = false;
  } catch (e) {
    changePwdMsg.value = (e as Error).message; changePwdError.value = true;
  } finally { changingPwd.value = false; }
}

// 方案三：导出/导入
const importMsg = ref('');

function handleExport() {
  mainStore.exportData().then(json => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = `flowerkey-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  });
}

async function handleImport(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const text = await file.text();
  const count = await mainStore.importData(text);
  importMsg.value = `已导入 ${count} 条新条目`;
}

function confirmClear() {
  if (confirm('确定要清除所有本地数据吗？此操作不可恢复。')) {
    indexedDB.deleteDatabase('FlowerKeyDB');
    location.reload();
  }
}
</script>

<style scoped>
.input { @apply w-full px-2 py-1.5 border rounded focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100; }
</style>
