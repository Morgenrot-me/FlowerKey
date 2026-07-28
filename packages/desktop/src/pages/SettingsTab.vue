<!--
  花钥桌面端 - 设置 Tab
  同步配置（WebDAV）+ 账户安全（恢复原主密码/导出导入）
-->
<template>
  <div class="h-full overflow-y-auto px-4 py-4 flex flex-col gap-4">

    <!-- 数据安全警告 -->
    <div v-if="!syncStore.config"
      class="p-3 bg-orange-50 border border-orange-300 rounded-xl text-orange-700 text-sm space-y-2">
      <p class="flex items-start gap-1.5"><AppIcon name="alert" :size="14" class-name="shrink-0 mt-0.5" /> <span>未配置同步，换设备将永久丢失所有数据，请配置 WebDAV 或定期导出备份。</span></p>
      <button @click="focusSyncConfig" class="w-full py-2.5 rounded-xl border border-orange-300/80 bg-white/70 text-orange-700 text-sm hover:bg-white">
        立即配置同步
      </button>
    </div>

    <!-- 同步配置 -->
    <div class="bg-white rounded-xl divide-y">
      <!-- WebDAV 配置表单 -->
      <div class="px-4 py-3 flex flex-col gap-2">
        <p class="text-sm font-medium">WebDAV 同步</p>
        <input ref="syncUrlInput" v-model="form.url" placeholder="服务器地址" class="input" />
        <input v-model="form.username" placeholder="用户名" class="input" />
        <input v-model="form.password" type="password" placeholder="密码" class="input" />
        <input v-model="form.basePath" placeholder="同步目录（默认 /FlowerKey）" class="input" />
        <button @click="saveConfig" class="w-full py-2.5 bg-gray-800 text-white rounded-xl text-sm">保存配置</button>
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
          <p class="text-gray-400 flex items-start gap-1.5"><AppIcon name="lock" :size="14" class-name="shrink-0 mt-0.5" /> <span>花钥只上传加密密文，坚果云无法读取任何内容。你的主密码永远不会离开设备。</span></p>
        </div>
      </div>

      <!-- 同步操作 -->
      <div class="px-4 py-3 flex flex-col gap-2">
        <button @click="syncStore.sync()" :disabled="syncStore.syncing || !syncStore.config"
          class="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
          <svg v-if="syncStore.syncing" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{{ syncStore.syncing ? '同步中...' : '立即同步' }}</span>
        </button>
        <p v-if="syncStore.config" class="text-xs text-gray-500 text-center">
          {{ syncStore.lastSyncTime ? `最近一次成功同步：${formatSyncTime(syncStore.lastSyncTime)}` : '尚未完成过成功同步，可点击“立即同步”验证当前配置。' }}
        </p>
        <p v-if="syncStore.lastResult" class="text-xs text-gray-500 text-center">
          本次结果：推送 {{ syncStore.lastResult.pushed }} 条，拉取 {{ syncStore.lastResult.pulled }} 条
        </p>
        <p v-if="syncStore.lastResult?.encryptMismatch" class="text-xs text-orange-600 text-center flex items-start justify-center gap-1.5">
          <AppIcon name="alert" :size="14" class-name="shrink-0 mt-0.5" />
          <span>{{ syncStore.lastResult.encryptMismatch }} 条书签因加密设置与其他设备不一致被跳过，请统一所有设备的书签加密设置后重新同步。</span>
        </p>
        <p v-if="syncStore.error" class="text-xs text-red-500 text-center">{{ syncStore.error }}</p>
      </div>
    </div>

    <!-- 书签设置已移除 -->
    <div v-if="false" class="bg-white rounded-xl divide-y">
      <div class="px-4 py-3 flex flex-col gap-2">
        <p class="text-sm font-medium">书签设置</p>
        <p class="text-xs text-gray-500">
          当前：书签{{ bookmarkEncrypt ? '已加密' : '未加密' }}。
          {{ bookmarkEncrypt ? '关闭后将解密所有书签，无需解锁即可查看。' : '开启后将加密所有书签，查看需要解锁。' }}
        </p>
        <p class="text-xs text-gray-400">多设备使用时，请确保所有设备的书签加密设置一致，否则同步时不一致的书签将被跳过。</p>
        <div v-if="!bookmarkEncrypt" class="rounded-xl border border-orange-200/80 bg-orange-50/80 px-3 py-2 text-xs text-orange-700 flex flex-col gap-1.5">
          <p class="flex items-start gap-1.5"><AppIcon name="alert" :size="14" class-name="shrink-0 mt-0.5" /> <span>书签当前以明文存储于本地，任何能访问应用数据的程序均可读取。</span></p>
          <button @click="showBookmarkPwdInput = true" class="w-full py-2.5 rounded-xl border border-orange-300/80 bg-white/80 text-orange-700 text-sm hover:bg-white">
            立即开启书签加密
          </button>
        </div>
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
        <p class="text-xs text-gray-500">恢复码会还原原主密码并直接解锁，不会改变历史生成密码。请妥善保管。</p>
        <div v-if="!hasRecovery" class="rounded-xl border border-blue-200/70 bg-blue-50/70 px-3 py-2 text-xs text-blue-700 flex flex-col gap-1.5">
          <p class="font-medium">建议现在就生成恢复码</p>
          <p class="leading-relaxed">这是忘记主密码后唯一可用的自救方式，生成后请离线抄写保存。</p>
          <button @click="handleGenerateRecovery" class="w-full py-2.5 rounded-xl border border-blue-200 bg-white/80 text-blue-700 text-sm hover:bg-white">
            立即生成恢复码
          </button>
        </div>
        <button @click="handleGenerateRecovery" class="w-full py-2.5 border rounded-xl text-sm">{{ hasRecovery ? '重新生成恢复码（旧码将失效）' : '生成新恢复码' }}</button>
        <div v-if="recoveryCode" class="p-3 bg-yellow-50 border border-yellow-300 rounded-xl break-all font-mono text-xs select-all">
          {{ recoveryCode }}
          <p class="text-yellow-600 mt-1 font-sans">请抄写保存，关闭后不再显示。</p>
          <p class="text-red-600 mt-1 font-sans font-medium flex items-start gap-1.5"><AppIcon name="alert" :size="14" class-name="shrink-0 mt-0.5" /> <span>恢复码不存储在本地。一旦丢失且忘记主密码，所有加密数据将永久无法恢复。</span></p>
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
        <label v-if="false" class="w-full py-2.5 border rounded-xl text-sm text-center cursor-pointer">
          导入浏览器书签（HTML）
          <input type="file" accept=".html" class="hidden" @change="handleImportBookmarks" />
        </label>
        <p v-if="importBookmarkMsg" class="text-xs text-green-600 text-center">{{ importBookmarkMsg }}</p>
      </div>
    </div>

    <!-- 安全说明 -->
    <div class="bg-white rounded-xl px-4 py-3 flex flex-col gap-2">
      <button @click="showSecurity = !showSecurity" class="w-full text-left text-sm font-medium flex justify-between items-center">
        <span>安全说明</span>
        <span class="text-gray-400">{{ showSecurity ? '▲' : '▼' }}</span>
      </button>
      <div v-if="showSecurity" class="flex flex-col gap-2 text-xs text-gray-500 leading-relaxed">
        <p class="font-medium text-gray-700">设计理念</p>
        <p>花钥无任何后端服务器，所有数据仅存于你的设备。同步时只上传加密密文，任何第三方均无法读取内容。</p>
        <p class="font-medium text-gray-700 pt-1">本地存储了什么</p>
        <table class="w-full border-collapse">
          <tr class="border-b"><td class="py-1 pr-2 text-gray-400 whitespace-nowrap">区分代号/标题/描述</td><td>加密存储，解锁后才可读取</td></tr>
          <tr class="border-b"><td class="py-1 pr-2 text-gray-400 whitespace-nowrap">网址/标签/类型</td><td>明文存储——本身不敏感，且未解锁时也能识别"此网站花钥已有密码"</td></tr>
          <tr class="border-b"><td class="py-1 pr-2 text-gray-400 whitespace-nowrap">身份密语</td><td>AES-256-GCM 包装后存储，主密码解锁后才进入内存</td></tr>
          <tr><td class="py-1 pr-2 text-gray-400 whitespace-nowrap">verifyHash</td><td>带随机盐的验证值，仅用于校验主密码</td></tr>
        </table>
        <p class="font-medium text-gray-700 pt-1">从未存储</p>
        <ul class="list-disc list-inside space-y-0.5">
          <li>主密码本身</li>
          <li>网站实际密码——花钥从不主动保存，按需生成、用完即弃；如需存储固定密码，需由你手动选择，同样以 AES-256-GCM 加密保存</li>
          <li>数据库加密密钥（仅存于内存，锁定后立即清除）</li>
        </ul>
        <p class="font-medium text-gray-700 pt-1">不可变生成根</p>
        <p>主密码和身份密语共同决定全部历史生成密码，设置后不提供普通修改入口。恢复码只恢复原主密码。</p>
        <p class="font-medium text-gray-700 pt-1">加密算法</p>
        <p>AES-256-GCM 是目前最主流的对称加密标准，1Password、Bitwarden 等主流密码管理工具均采用此算法。花钥用它加密区分代号等敏感字段——但请注意，<span class="text-gray-700">单独的区分代号无法算出密码</span>，最终密码由"区分代号 + 你的记忆密码"共同决定。记忆密码只存在于你的脑中，从不上传、从不存储，密码的最终所有权永远属于你。</p>
        <p>密钥派生：PBKDF2（600,000 次迭代，SHA-256），基于浏览器原生 Web Crypto API，零外部依赖。</p>
        <p class="font-medium text-gray-700 pt-1">网络请求</p>
        <p>本应用仅向你配置的 WebDAV 地址发送请求，无任何遥测、无回调、无第三方服务。</p>
      </div>
    </div>

    <!-- 版本 + 锁定 -->
    <div class="bg-white rounded-xl divide-y">
      <div class="px-4 py-3 flex items-center justify-between">
        <span class="text-sm">版本</span>
        <span class="text-sm text-gray-400">{{ version }}</span>
      </div>
    </div>
    <button @click="$emit('lock')" class="w-full py-3 border border-red-300 text-red-500 rounded-xl text-sm">锁定</button>
    <ConfirmDialog :visible="confirmVisible" :title="confirmOpts.title" :message="confirmOpts.message"
      :confirm-text="confirmOpts.confirmText" :cancel-text="confirmOpts.cancelText" :danger="confirmOpts.danger"
      @confirm="onConfirm" @cancel="onCancel" />
    <Toast :visible="toast.visible.value" :message="toast.message.value" :type="toast.type.value" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useMainStore } from '../stores/main';
import { useSyncStore } from '../stores/sync';
import { db, type WebDAVConfig } from '@flowerkey/core';
import { useConfirm } from '../../../ui/src/composables/useConfirm';
import { useToast } from '../../../ui/src/composables/useToast';
import { getImportEntryCount } from '../../../ui/src/utils/import-preview';
import ConfirmDialog from '../../../ui/src/components/ConfirmDialog.vue';
import Toast from '../../../ui/src/components/Toast.vue';
import AppIcon from '../../../ui/src/icons/AppIcon.vue';

defineEmits<{ lock: [] }>();

declare const __APP_VERSION__: string;
const version = __APP_VERSION__;

const mainStore = useMainStore();
const syncStore = useSyncStore();
const { visible: confirmVisible, options: confirmOpts, ask, onConfirm, onCancel } = useConfirm();
const syncUrlInput = ref<HTMLInputElement | null>(null);
const toast = useToast();
const form = ref<WebDAVConfig>({ url: '', username: '', password: '', basePath: '/FlowerKey' });
const showDavGuide = ref(false);
const showSecurity = ref(false);

function formatSyncTime(ts: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

onMounted(async () => {
  await syncStore.loadConfig();
  if (syncStore.config) Object.assign(form.value, syncStore.config);
  bookmarkEncrypt.value = (await db.getConfig<boolean>('bookmarkEncrypt')) ?? true;
  const data = await db.getMasterData();
  hasRecovery.value = !!(data?.encryptedMasterPwd);
});

async function focusSyncConfig() {
  await nextTick();
  syncUrlInput.value?.focus();
}

async function saveConfig() {
  if (!form.value.url || !form.value.username) return;
  await syncStore.saveConfig({ ...form.value });
  toast.show('配置已保存', 'success');
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
const hasRecovery = ref(false);
async function handleGenerateRecovery() {
  const data = await db.getMasterData();
  hasRecovery.value = !!(data?.encryptedMasterPwd);
  if (hasRecovery.value) {
    if (!await ask('已存在恢复码，重新生成后旧恢复码将立即失效且无法恢复。确认继续？', { title: '重新生成恢复码', danger: true })) return;
  }
  recoveryCode.value = await mainStore.generateRecovery();
  hasRecovery.value = true;
}

const importMsg = ref('');
const importBookmarkMsg = ref('');

function buildImportSummary(imported: number, total: number, label: string) {
  const skipped = Math.max(total - imported, 0);
  return `本次共读取 ${total} 条${label}，新增 ${imported} 条，跳过 ${skipped} 条已存在内容。`;
}

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
  const total = getImportEntryCount(text);
  const count = await mainStore.importData(text);
  importMsg.value = buildImportSummary(count, total, '条备份条目');
  toast.show(importMsg.value, 'success');
}

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
  importBookmarkMsg.value = buildImportSummary(count, items.length, '条书签');
  toast.show(importBookmarkMsg.value, 'success');
}
</script>
