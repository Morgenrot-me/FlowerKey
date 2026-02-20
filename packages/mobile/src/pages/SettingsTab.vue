<!--
  花钥移动端 - 设置 Tab
  同步配置（WebDAV / iCloud）+ 账户安全（恢复码/改密/导出导入）
-->
<template>
  <div class="h-full overflow-y-auto px-4 py-4 flex flex-col gap-4">

    <!-- 数据安全警告 -->
    <div v-if="!syncStore.hasBackend()"
      class="p-3 bg-orange-50 border border-orange-300 rounded-xl text-orange-700 text-sm">
      ⚠️ 卸载应用或换设备将永久丢失所有数据，请配置同步或定期导出备份。
    </div>

    <!-- 同步配置 -->
    <div class="bg-white rounded-xl divide-y">
      <!-- 同步方式选择 -->
      <div class="px-4 py-3">
        <p class="text-sm font-medium mb-2">同步方式</p>
        <p class="text-xs text-gray-400 mb-2">WebDAV 可与浏览器插件互通；iCloud 仅限 iOS 设备间同步。</p>
        <div class="flex gap-2">
          <button @click="syncStore.setSyncMode('webdav')"
            :class="['flex-1 py-2 rounded-xl text-sm border', syncStore.syncMode === 'webdav' ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300']">
            WebDAV
          </button>
          <button @click="syncStore.setSyncMode('icloud')"
            :class="['flex-1 py-2 rounded-xl text-sm border', syncStore.syncMode === 'icloud' ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300']">
             iCloud
          </button>
        </div>
      </div>

      <!-- WebDAV 配置表单 -->
      <div v-if="syncStore.syncMode === 'webdav'" class="px-4 py-3 flex flex-col gap-2">
        <input v-model="form.url" placeholder="服务器地址" class="input" />
        <input v-model="form.username" placeholder="用户名" class="input" />
        <input v-model="form.password" type="password" placeholder="密码" class="input" />
        <input v-model="form.basePath" placeholder="同步目录（默认 /FlowerKey）" class="input" />
        <button @click="saveConfig" class="w-full py-2.5 bg-gray-800 text-white rounded-xl text-sm">保存配置</button>
        <p v-if="configSaved" class="text-xs text-green-600 text-center">配置已保存</p>
        <!-- 坚果云教程 -->
        <button @click="showDavGuide = !showDavGuide" class="text-left text-xs text-blue-500">
          {{ showDavGuide ? '▲ 收起' : '▼ 如何配置坚果云？' }}
        </button>
        <div v-if="showDavGuide" class="p-3 bg-blue-50 rounded-xl flex flex-col gap-1.5 text-xs text-gray-600 leading-relaxed">
          <p class="font-medium">坚果云配置步骤</p>
          <p>① 登录坚果云网页版 → 右上角头像 → <b>账户信息</b> → <b>安全选项</b></p>
          <p>② 找到「第三方应用管理」→ <b>添加应用</b>，名称随意，点击<b>生成密码</b></p>
          <p>③ 回到花钥，填写：</p>
          <p class="font-mono text-[11px] bg-white rounded p-2">服务器：https://dav.jianguoyun.com/dav/<br/>用户名：坚果云注册邮箱<br/>密码：刚才生成的应用密码</p>
          <p class="text-gray-400">🔒 花钥只上传加密密文，坚果云无法读取任何内容。你的主密码永远不会离开设备。</p>
        </div>
      </div>

      <!-- iCloud 说明 -->
      <div v-else class="px-4 py-3 flex flex-col gap-2">
        <p class="text-xs text-gray-500">数据将同步至 iCloud Drive / FlowerKey 目录，无需账号密码，开箱即用。</p>
        <button @click="showICloudGuide = !showICloudGuide" class="text-left text-xs text-blue-500">
          {{ showICloudGuide ? '▲ 收起' : '▼ 使用前请确认' }}
        </button>
        <div v-if="showICloudGuide" class="p-3 bg-blue-50 rounded-xl flex flex-col gap-1.5 text-xs text-gray-600 leading-relaxed">
          <p class="font-medium">iCloud 同步前提</p>
          <p>① 设置 → 顶部账户 → iCloud → 确认已开启 <b>iCloud Drive</b></p>
          <p>② 设置 → 顶部账户 → iCloud → 向下找到花钥，确认已开启同步开关</p>
          <p>③ 多设备同步时，所有设备均需登录<b>同一 Apple ID</b></p>
          <p class="text-gray-400">🔒 花钥只上传加密密文，Apple 无法读取任何内容。你的主密码永远不会离开设备。</p>
        </div>
      </div>

      <!-- 同步操作 -->
      <div class="px-4 py-3 flex flex-col gap-2">
        <button @click="syncStore.sync()" :disabled="syncStore.syncing || !syncStore.hasBackend()"
          class="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm disabled:opacity-50">
          {{ syncStore.syncing ? '同步中...' : '立即同步' }}
        </button>
        <p v-if="syncStore.lastResult" class="text-xs text-gray-500 text-center">
          上次同步：推送 {{ syncStore.lastResult.pushed }} 条，拉取 {{ syncStore.lastResult.pulled }} 条
        </p>
        <p v-if="syncStore.lastResult?.encryptMismatch" class="text-xs text-orange-600 text-center">
          ⚠️ {{ syncStore.lastResult.encryptMismatch }} 条书签因加密设置与其他设备不一致被跳过，请统一所有设备的书签加密设置后重新同步。
        </p>
        <p v-if="syncStore.error" class="text-xs text-red-500 text-center">{{ syncStore.error }}</p>
      </div>
    </div>

    <!-- 书签设置 -->
    <div class="bg-white rounded-xl divide-y">
      <div class="px-4 py-3 flex flex-col gap-2">
        <p class="text-sm font-medium">书签设置</p>
        <p class="text-xs text-gray-500">
          当前：书签{{ bookmarkEncrypt ? '已加密' : '未加密' }}。
          {{ bookmarkEncrypt ? '关闭后将解密所有书签，无需解锁即可查看。' : '开启后将加密所有书签，查看需要解锁。' }}
        </p>
        <p class="text-xs text-gray-400">多设备使用时，请确保所有设备的书签加密设置一致，否则同步时不一致的书签将被跳过。</p>
        <p v-if="!bookmarkEncrypt" class="text-xs text-orange-600">⚠️ 书签以明文存储于本地，任何能访问应用数据的程序均可读取。</p>
        <div v-if="!showBookmarkPwdInput">
          <button @click="showBookmarkPwdInput = true" class="w-full py-2.5 border rounded-xl text-sm">
            {{ bookmarkEncrypt ? '关闭书签加密' : '开启书签加密' }}
          </button>
        </div>
        <div v-else class="flex flex-col gap-2">
          <p class="text-xs text-yellow-600">请输入主密码以确认操作：</p>
          <input v-model="bookmarkPwdInput" type="password" placeholder="主密码" class="input" />
          <div class="flex gap-2">
            <button @click="confirmBookmarkEncrypt" :disabled="bookmarkEncryptProcessing" class="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm disabled:opacity-50">
              {{ bookmarkEncryptProcessing ? '处理中...' : '确认' }}
            </button>
            <button @click="cancelBookmarkEncrypt" class="flex-1 py-2.5 border rounded-xl text-sm">取消</button>
          </div>
          <p v-if="bookmarkEncryptError" class="text-xs text-red-500">{{ bookmarkEncryptError }}</p>
        </div>
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
          <p class="text-red-600 mt-1 font-sans font-medium">⚠️ 恢复码不存储在本地。一旦丢失且忘记主密码，所有加密数据将永久无法恢复。</p>
        </div>
      </div>

      <!-- 修改主密码 -->
      <div class="px-4 py-3 flex flex-col gap-2">
        <button @click="showChangePwd = !showChangePwd" class="w-full py-2.5 border rounded-xl text-sm text-left">修改主密码</button>
        <div v-if="showChangePwd" class="flex flex-col gap-2">
          <p class="text-xs text-gray-400">修改主密码将重新加密所有本地数据，条目较多时可能需要数秒。</p>
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
        <label class="w-full py-2.5 border rounded-xl text-sm text-center cursor-pointer">
          导入浏览器书签（HTML）
          <input type="file" accept=".html" class="hidden" @change="handleImportBookmarks" />
        </label>
        <p v-if="importBookmarkMsg" class="text-xs text-green-600 text-center">{{ importBookmarkMsg }}</p>
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
import { db, type WebDAVConfig } from '@flowerkey/core';

defineEmits<{ lock: [] }>();

const mainStore = useMainStore();
const syncStore = useSyncStore();
const form = ref<WebDAVConfig>({ url: '', username: '', password: '', basePath: '/FlowerKey' });
const showDavGuide = ref(false);
const showICloudGuide = ref(false);

onMounted(async () => {
  await syncStore.loadConfig();
  if (syncStore.config) Object.assign(form.value, syncStore.config);
  bookmarkEncrypt.value = (await db.getConfig<boolean>('bookmarkEncrypt')) ?? true;
});

const configSaved = ref(false);
async function saveConfig() {
  if (!form.value.url || !form.value.username) return;
  await syncStore.saveConfig({ ...form.value });
  configSaved.value = true;
  setTimeout(() => { configSaved.value = false; }, 2000);
}

// 书签加密
const bookmarkEncrypt = ref(true);
const showBookmarkPwdInput = ref(false);
const bookmarkPwdInput = ref('');
const bookmarkEncryptProcessing = ref(false);
const bookmarkEncryptError = ref('');

function cancelBookmarkEncrypt() {
  showBookmarkPwdInput.value = false;
  bookmarkPwdInput.value = '';
  bookmarkEncryptError.value = '';
}

async function confirmBookmarkEncrypt() {
  bookmarkEncryptError.value = '';
  bookmarkEncryptProcessing.value = true;
  try {
    const ok = await mainStore.unlock(bookmarkPwdInput.value);
    if (!ok) { bookmarkEncryptError.value = '密码错误'; return; }
    const newVal = !bookmarkEncrypt.value;
    await db.setBookmarkEncryption(newVal);
    await db.setConfig('bookmarkEncrypt', newVal);
    bookmarkEncrypt.value = newVal;
    cancelBookmarkEncrypt();
  } finally {
    bookmarkEncryptProcessing.value = false;
  }
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

const importBookmarkMsg = ref('');
async function handleImportBookmarks(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  const html = await file.text();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const links = Array.from(doc.querySelectorAll('a[href]'));
  const items = links.map(a => ({
    title: a.textContent?.trim() || a.getAttribute('href') || '',
    url: a.getAttribute('href') || '',
    favicon: a.getAttribute('icon') || undefined,
  })).filter(i => i.url.startsWith('http'));
  const encrypt = (await db.getConfig<boolean>('bookmarkEncrypt')) ?? true;
  const count = await db.importBookmarks(items, encrypt);
  importBookmarkMsg.value = `已导入 ${count} 条书签（跳过重复 ${items.length - count} 条）`;
}
</script>

<style scoped>
.input { @apply w-full px-4 py-3 border rounded-xl text-sm outline-none focus:border-blue-400; }
</style>
