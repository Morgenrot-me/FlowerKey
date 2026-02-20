<!--
  花钥 - 设置页
  WebDAV 配置 + 同步操作 + 账户安全（恢复码/改密/导出导入）
-->
<template>
  <div class="p-4 space-y-4 text-xs">
    <h2 class="text-sm font-bold">设置</h2>

    <!-- 数据安全警告 -->
    <div v-if="!syncStore.config"
      class="p-2 bg-orange-50 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded text-orange-700 dark:text-orange-300">
      ⚠️ 未配置 WebDAV 同步。卸载插件或换设备将永久丢失所有数据，建议配置同步或定期导出备份。
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
      <!-- 坚果云教程 -->
      <button @click="showDavGuide = !showDavGuide" class="w-full text-left text-blue-500 hover:underline">
        {{ showDavGuide ? '▲ 收起' : '▼ 如何配置坚果云？' }}
      </button>
      <div v-if="showDavGuide" class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded space-y-1.5 text-gray-600 dark:text-gray-300 leading-relaxed">
        <p class="font-medium">坚果云配置步骤</p>
        <p>① 登录坚果云网页版 → 右上角头像 → <b>账户信息</b> → <b>安全选项</b></p>
        <p>② 找到「第三方应用管理」→ <b>添加应用</b>，名称随意，点击<b>生成密码</b></p>
        <p>③ 回到花钥，填写：</p>
        <table class="w-full text-[10px] mt-1">
          <tr><td class="pr-2 text-gray-400 whitespace-nowrap">服务器地址</td><td class="font-mono">https://dav.jianguoyun.com/dav/</td></tr>
          <tr><td class="pr-2 text-gray-400">用户名</td><td>坚果云注册邮箱</td></tr>
          <tr><td class="pr-2 text-gray-400">密码</td><td>刚才生成的<b>应用密码</b>（非登录密码）</td></tr>
        </table>
        <p class="text-[10px] text-gray-400 pt-1">🔒 花钥只上传加密密文，坚果云无法读取任何内容。你的主密码永远不会离开设备。</p>
      </div>
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
      <p v-if="syncStore.lastResult?.encryptMismatch" class="text-orange-600 dark:text-orange-400">
        ⚠️ {{ syncStore.lastResult.encryptMismatch }} 条书签因加密设置与其他设备不一致被跳过，请在所有设备上统一书签加密设置后重新同步。
      </p>
      <p v-if="syncStore.error" class="text-red-500">{{ syncStore.error }}</p>
    </div>

    <!-- 书签加密 -->
    <div class="border-t pt-3 space-y-2">
      <p class="font-medium text-gray-700 dark:text-gray-300">书签设置</p>
      <p class="text-gray-500 dark:text-gray-400">
        当前：书签{{ bookmarkEncrypt ? '已加密' : '未加密' }}。
        {{ bookmarkEncrypt ? '关闭后将解密所有书签，无需解锁即可查看。' : '开启后将加密所有书签，查看需要解锁。' }}
      </p>
      <p class="text-[10px] text-gray-400 dark:text-gray-500">多设备使用时，请确保所有设备的书签加密设置一致，否则同步时不一致的书签将被跳过。</p>
      <p v-if="!bookmarkEncrypt" class="text-orange-600 dark:text-orange-400">⚠️ 书签以明文存储于本地 IndexedDB，任何能访问浏览器数据的程序均可读取。</p>
      <div v-if="!showBookmarkPwdInput">
        <button @click="showBookmarkPwdInput = true" class="w-full py-1.5 border rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">
          {{ bookmarkEncrypt ? '关闭书签加密' : '开启书签加密' }}
        </button>
      </div>
      <div v-else class="space-y-1">
        <p class="text-yellow-600 dark:text-yellow-400">请输入主密码以确认操作：</p>
        <input v-model="bookmarkPwdInput" type="password" placeholder="主密码" class="input" @keyup.enter="confirmBookmarkEncrypt" />
        <div class="flex gap-2">
          <button @click="confirmBookmarkEncrypt" :disabled="bookmarkEncryptProcessing" class="flex-1 py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50">
            {{ bookmarkEncryptProcessing ? '处理中...' : '确认' }}
          </button>
          <button @click="cancelBookmarkEncrypt" class="flex-1 py-1.5 border rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">取消</button>
        </div>
        <p v-if="bookmarkEncryptError" class="text-red-500">{{ bookmarkEncryptError }}</p>
      </div>
    </div>

    <!-- 账户安全 -->
    <div class="border-t pt-3 space-y-3">
      <p class="font-medium text-gray-700 dark:text-gray-300">账户安全</p>

      <!-- 方案一：恢复码 -->
      <div class="space-y-1">
        <p class="text-gray-500 dark:text-gray-400">恢复码可在忘记主密码时恢复账户，请妥善保管。</p>
        <button @click="handleGenerateRecovery" class="w-full py-1.5 border rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">
          {{ hasRecovery ? '重新生成恢复码（旧码将失效）' : '生成恢复码' }}
        </button>
        <div v-if="recoveryCode" class="p-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded break-all font-mono select-all">
          {{ recoveryCode }}
          <p class="text-yellow-600 dark:text-yellow-400 mt-1 font-sans">请抄写或打印保存，关闭后不再显示。</p>
          <p class="text-red-600 dark:text-red-400 mt-1 font-sans font-medium">⚠️ 恢复码不存储在本地。一旦丢失且忘记主密码，所有加密数据将永久无法恢复。</p>
        </div>
      </div>

      <!-- 方案二：修改主密码 -->
      <div class="space-y-1">
        <button @click="showChangePwd = !showChangePwd" class="w-full py-1.5 border rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">
          修改主密码
        </button>
        <div v-if="showChangePwd" class="space-y-1">
          <p class="text-[10px] text-gray-400 dark:text-gray-500">修改主密码将重新加密所有本地数据，条目较多时可能需要数秒。</p>
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

      <!-- 方案四：批量导入书签 -->
      <div class="space-y-1">
        <p class="text-gray-500 dark:text-gray-400">从浏览器导出的书签 HTML 文件批量导入（跳过已存在 URL）。</p>
        <label class="block w-full py-1.5 border rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800 text-center cursor-pointer">
          导入浏览器书签
          <input type="file" accept=".html" class="hidden" @change="handleImportBookmarks" />
        </label>
        <p v-if="importBookmarkMsg" class="text-green-600">{{ importBookmarkMsg }}</p>
      </div>
    </div>

    <!-- 危险操作 -->
    <div class="border-t pt-3 space-y-2">
      <p class="font-medium text-gray-700 dark:text-gray-300">危险操作</p>
      <button @click="confirmClear" class="w-full py-1.5 border border-red-300 text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
        清除本地数据
      </button>
    </div>

    <!-- 安全说明 -->
    <div class="border-t pt-3 space-y-2">
      <button @click="showSecurity = !showSecurity" class="w-full text-left font-medium text-gray-700 dark:text-gray-300 flex justify-between items-center">
        <span>安全说明</span>
        <span class="text-gray-400">{{ showSecurity ? '▲' : '▼' }}</span>
      </button>
      <div v-if="showSecurity" class="space-y-2 text-gray-500 dark:text-gray-400 leading-relaxed">
        <p class="font-medium text-gray-600 dark:text-gray-300">本地存储了什么</p>
        <table class="w-full text-[10px] border-collapse">
          <tr class="border-b dark:border-gray-700"><td class="py-1 pr-2 text-gray-400">verifyHash</td><td>明文哈希，仅用于验证密码，无法反推主密码</td></tr>
          <tr class="border-b dark:border-gray-700"><td class="py-1 pr-2 text-gray-400">代号/URL/标题</td><td>AES-256-GCM 加密后存储</td></tr>
          <tr><td class="py-1 pr-2 text-gray-400">id/类型/标签</td><td>明文（索引字段，不含敏感信息）</td></tr>
        </table>
        <p class="font-medium text-gray-600 dark:text-gray-300 pt-1">从未存储</p>
        <ul class="list-disc list-inside text-[10px] space-y-0.5">
          <li>主密码本身</li>
          <li>任何网站的实际密码（生成模式）</li>
          <li>数据库加密密钥（仅存于内存，锁定后清除）</li>
        </ul>
        <p class="font-medium text-gray-600 dark:text-gray-300 pt-1">加密算法</p>
        <p class="text-[10px]">PBKDF2（600,000 次迭代，SHA-256）+ AES-256-GCM，基于浏览器原生 Web Crypto API，零外部依赖。</p>
        <p class="font-medium text-gray-600 dark:text-gray-300 pt-1">网络请求</p>
        <p class="text-[10px]">本插件仅向你配置的 WebDAV 地址发送请求，无任何遥测、无回调、无第三方服务。</p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useSyncStore } from '../stores/sync';
import { useMainStore } from '../stores/main';
import type { WebDAVConfig } from '@flowerkey/core';
import { db } from '@flowerkey/core';

const syncStore = useSyncStore();
const mainStore = useMainStore();

const form = ref<WebDAVConfig>({ url: '', username: '', password: '', basePath: '/FlowerKey' });

onMounted(async () => {
  await syncStore.loadConfig();
  if (syncStore.config) Object.assign(form.value, syncStore.config);
  const data = await db.getMasterData();
  hasRecovery.value = !!(data?.encryptedMasterPwd);
  bookmarkEncrypt.value = (await db.getConfig<boolean>('bookmarkEncrypt')) ?? true;
});

async function saveConfig() {
  if (!form.value.url || !form.value.username) return;
  await syncStore.saveConfig({ ...form.value });
}

// 书签加密设置
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

// 方案一：恢复码
const recoveryCode = ref('');
const hasRecovery = ref(false);
async function handleGenerateRecovery() {
  if (hasRecovery.value && !confirm('生成新恢复码后，旧恢复码将立即失效，确认继续？')) return;
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
const showSecurity = ref(false);
const showDavGuide = ref(false);

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
