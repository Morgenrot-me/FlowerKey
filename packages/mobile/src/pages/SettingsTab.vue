<!--
  花钥移动端 - 设置 Tab
  WebDAV 同步配置 + 账户安全（恢复码/改密/导出导入）
-->
<template>
  <div class="h-full overflow-y-auto px-4 py-4 flex flex-col gap-4">

    <!-- 数据安全警告 -->
    <div class="p-3 bg-orange-50 border border-orange-300 rounded-xl text-orange-700 text-sm">
      ⚠️ 卸载应用或换设备将永久丢失所有数据，请配置 WebDAV 同步或定期导出备份。
    </div>

    <!-- WebDAV 配置 -->
    <div class="bg-white rounded-xl divide-y">
      <div class="px-4 py-3">
        <p class="text-sm font-medium mb-2">WebDAV 同步</p>
        <div class="flex flex-col gap-2">
          <input v-model="form.url" placeholder="服务器地址" class="input" />
          <input v-model="form.username" placeholder="用户名" class="input" />
          <input v-model="form.password" type="password" placeholder="密码" class="input" />
          <input v-model="form.basePath" placeholder="同步目录（默认 /FlowerKey）" class="input" />
          <button @click="saveConfig" class="w-full py-2.5 bg-gray-800 text-white rounded-xl text-sm">保存配置</button>
        </div>
      </div>
      <div class="px-4 py-3 flex flex-col gap-2">
        <button @click="syncStore.sync()" :disabled="syncStore.syncing || !syncStore.config"
          class="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm disabled:opacity-50">
          {{ syncStore.syncing ? '同步中...' : '立即同步' }}
        </button>
        <p v-if="syncStore.lastResult" class="text-xs text-gray-500 text-center">
          上次同步：推送 {{ syncStore.lastResult.pushed }} 条，拉取 {{ syncStore.lastResult.pulled }} 条
        </p>
        <p v-if="syncStore.error" class="text-xs text-red-500 text-center">{{ syncStore.error }}</p>
      </div>
    </div>

    <!-- 账户安全 -->
    <div class="bg-white rounded-xl divide-y">
      <!-- 恢复码 -->
      <div class="px-4 py-3 flex flex-col gap-2">
        <p class="text-sm font-medium">恢复码</p>
        <p class="text-xs text-gray-500">忘记主密码时可用恢复码解锁，请妥善保管。</p>
        <button @click="handleGenerateRecovery" class="w-full py-2.5 border rounded-xl text-sm">生成新恢复码</button>
        <div v-if="recoveryCode" class="p-3 bg-yellow-50 border border-yellow-300 rounded-xl break-all font-mono text-xs select-all">
          {{ recoveryCode }}
          <p class="text-yellow-600 mt-1 font-sans">请抄写保存，关闭后不再显示。</p>
        </div>
      </div>

      <!-- 修改主密码 -->
      <div class="px-4 py-3 flex flex-col gap-2">
        <button @click="showChangePwd = !showChangePwd" class="w-full py-2.5 border rounded-xl text-sm text-left">修改主密码</button>
        <div v-if="showChangePwd" class="flex flex-col gap-2">
          <input v-model="newPwd" type="password" placeholder="新主密码" class="input" />
          <input v-model="newPwdConfirm" type="password" placeholder="确认新主密码" class="input" />
          <button @click="handleChangePwd" :disabled="changingPwd"
            class="w-full py-2.5 bg-orange-500 text-white rounded-xl text-sm disabled:opacity-50">
            {{ changingPwd ? '处理中...' : '确认修改' }}
          </button>
          <p v-if="changePwdMsg" :class="changePwdError ? 'text-red-500' : 'text-green-600'" class="text-xs text-center">{{ changePwdMsg }}</p>
        </div>
      </div>

      <!-- 导出/导入 -->
      <div class="px-4 py-3 flex flex-col gap-2">
        <p class="text-sm font-medium">备份</p>
        <div class="flex gap-2">
          <button @click="handleExport" class="flex-1 py-2.5 border rounded-xl text-sm">导出备份</button>
          <label class="flex-1 py-2.5 border rounded-xl text-sm text-center cursor-pointer">
            导入备份
            <input type="file" accept=".json" class="hidden" @change="handleImport" />
          </label>
        </div>
        <p v-if="importMsg" class="text-xs text-green-600 text-center">{{ importMsg }}</p>
      </div>
    </div>

    <!-- 版本 + 锁定 -->
    <div class="bg-white rounded-xl divide-y">
      <div class="px-4 py-3 flex items-center justify-between">
        <span class="text-sm">版本</span>
        <span class="text-sm text-gray-400">0.1.0</span>
      </div>
    </div>
    <button @click="$emit('lock')" class="w-full py-3 border border-red-300 text-red-500 rounded-xl text-sm">锁定</button>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMainStore } from '../stores/main';
import { useSyncStore } from '../stores/sync';
import type { WebDAVConfig } from '@flowerkey/core';

defineEmits<{ lock: [] }>();

const mainStore = useMainStore();
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

const recoveryCode = ref('');
async function handleGenerateRecovery() {
  recoveryCode.value = await mainStore.generateRecovery();
}

const showChangePwd = ref(false);
const newPwd = ref(''), newPwdConfirm = ref('');
const changingPwd = ref(false), changePwdMsg = ref(''), changePwdError = ref(false);

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
  const count = await mainStore.importData(await file.text());
  importMsg.value = `已导入 ${count} 条新条目`;
}
</script>

<style scoped>
.input { @apply w-full px-4 py-3 border rounded-xl text-sm outline-none focus:border-blue-400; }
</style>
