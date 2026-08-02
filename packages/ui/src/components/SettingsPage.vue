<!--
  花钥 - 设置页
  WebDAV 配置 + 同步操作 + 账户安全（恢复原主密码/导出导入）
-->
<template>
  <div class="p-4 space-y-4 text-xs">
    <h2 class="text-sm font-bold">设置</h2>

    <!-- 数据安全警告 -->
    <div v-if="!syncStore.config"
      class="p-2 bg-orange-50 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-700 rounded text-orange-700 dark:text-orange-300 space-y-2">
      <p class="flex items-start gap-1.5"><AppIcon name="alert" :size="14" class-name="shrink-0 mt-0.5" /> <span>未配置 WebDAV 同步。卸载插件或换设备将永久丢失所有数据，建议配置同步或定期导出备份。</span></p>
      <button @click="focusSyncConfig" class="w-full py-1.5 rounded border border-orange-300/80 bg-white/70 text-orange-700 hover:bg-white dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-200 dark:hover:bg-orange-950/50">
        立即配置同步
      </button>
    </div>

    <!-- WebDAV 配置 -->
    <div class="space-y-2">
      <p class="font-medium text-gray-700 dark:text-gray-300">WebDAV 同步</p>
      <p class="text-[11px] text-gray-400 dark:text-gray-500">配置后可与手机端花钥双向同步，WebDAV 是浏览器插件与移动端互通的唯一方式。</p>
      <input ref="syncUrlInput" v-model="form.url" placeholder="服务器地址（如 https://dav.jianguoyun.com/dav/）" class="input" />
      <input v-model="form.username" placeholder="用户名" class="input" />
      <input v-model="form.password" type="password" placeholder="密码" class="input" />
      <input v-model="form.basePath" placeholder="同步目录（默认 /FlowerKey）" class="input" />
      <button @click="saveConfig" class="w-full py-1.5 bg-gray-800 text-white rounded hover:bg-gray-700 dark:bg-gray-600 dark:hover:bg-gray-500">
        保存配置
      </button>
      <!-- 坚果云教程 -->
      <button @click="showDavGuide = !showDavGuide" class="w-full flex items-center justify-between gap-1 text-left text-blue-500 hover:underline">
        <span>{{ showDavGuide ? '收起' : '如何配置坚果云？' }}</span>
        <AppIcon :name="showDavGuide ? 'chevron-up' : 'chevron-down'" :size="12" class-name="shrink-0" />
      </button>
      <div v-if="showDavGuide" class="p-2 bg-blue-50 dark:bg-blue-900/20 rounded space-y-1.5 text-gray-600 dark:text-gray-300 leading-relaxed">
        <p class="font-medium">坚果云配置步骤</p>
        <p>① 登录坚果云网页版 → 右上角头像 → <b>账户信息</b> → <b>安全选项</b></p>
        <p>② 找到「第三方应用管理」→ <b>添加应用</b>，名称随意，点击<b>生成密码</b></p>
        <p>③ 回到花钥，填写：</p>
        <table class="w-full text-[11px] mt-1">
          <tr><td class="pr-2 text-gray-400 whitespace-nowrap">服务器地址</td><td class="font-mono">https://dav.jianguoyun.com/dav/</td></tr>
          <tr><td class="pr-2 text-gray-400">用户名</td><td>坚果云注册邮箱</td></tr>
          <tr><td class="pr-2 text-gray-400">密码</td><td>刚才生成的<b>应用密码</b>（非登录密码）</td></tr>
        </table>
        <p class="text-[11px] text-gray-400 pt-1 flex items-start gap-1.5"><AppIcon name="lock" :size="12" class-name="shrink-0 mt-0.5" /> <span>花钥只上传加密密文，坚果云无法读取任何内容。你的主密码永远不会离开设备。</span></p>
      </div>
    </div>

    <!-- 同步操作 -->
    <div class="space-y-2">
      <button
        @click="syncStore.sync()"
        :disabled="syncStore.syncing || !syncStore.config"
        class="w-full py-1.5 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        <svg v-if="syncStore.syncing" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
          <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span>{{ syncStore.syncing ? '同步中...' : '立即同步' }}</span>
      </button>
      <p v-if="syncStore.config" class="text-gray-500 dark:text-gray-400">
        {{ syncStore.lastSyncTime ? `最近一次成功同步：${formatSyncTime(syncStore.lastSyncTime)}` : '尚未完成过成功同步，可点击“立即同步”验证当前配置。' }}
      </p>
      <p v-if="syncStore.lastResult" class="text-gray-500 dark:text-gray-400">
        本次结果：推送 {{ syncStore.lastResult.pushed }} 条，拉取 {{ syncStore.lastResult.pulled }} 条
      </p>
      <p v-if="syncStore.error" class="text-red-500">{{ syncStore.error }}</p>
    </div>

    <!-- 锁定超时 -->
    <div class="border-t pt-3 space-y-2">
      <p class="font-medium text-gray-700 dark:text-gray-300">自动锁定</p>
      <div class="flex items-center gap-2">
        <span class="text-gray-500 dark:text-gray-400">闲置</span>
        <select v-model.number="lockTimeout" @change="saveLockTimeout" class="input flex-1">
          <option :value="1">1 分钟</option>
          <option :value="5">5 分钟</option>
          <option :value="15">15 分钟</option>
          <option :value="30">30 分钟</option>
          <option :value="60">1 小时</option>
          <option :value="480">8 小时</option>
        </select>
        <span class="text-gray-500 dark:text-gray-400">后锁定</span>
      </div>
      <label class="flex items-center gap-2 cursor-pointer">
        <input type="checkbox" v-model="lockOnClose" @change="saveLockOnClose" class="rounded" />
        <span class="text-gray-500 dark:text-gray-400">关闭侧边栏时立即锁定</span>
      </label>
    </div>

    <!-- 账户安全 -->
    <div class="border-t pt-3 space-y-3">
      <p class="font-medium text-gray-700 dark:text-gray-300">账户安全</p>

      <!-- 方案一：恢复码 -->
      <div class="space-y-1">
        <p class="text-gray-500 dark:text-gray-400">恢复码会还原原主密码并直接解锁，不会改变历史生成密码。请妥善保管。</p>
        <div v-if="!hasRecovery" class="rounded border border-blue-200/70 bg-blue-50/70 px-2.5 py-2 text-[11px] text-blue-700 dark:border-blue-800/70 dark:bg-blue-900/20 dark:text-blue-200 space-y-1.5">
          <p class="font-medium">建议现在就生成恢复码</p>
          <p>这是忘记主密码后唯一可用的自救方式，生成后请离线抄写保存。</p>
          <button @click="handleGenerateRecovery" class="w-full py-1.5 rounded border border-blue-200 bg-white/80 text-blue-700 hover:bg-white dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950/50">
            立即生成恢复码
          </button>
        </div>
        <button @click="handleGenerateRecovery" class="w-full py-1.5 border rounded hover:bg-gray-50 dark:border-gray-600 dark:hover:bg-gray-800">
          {{ hasRecovery ? '重新生成恢复码（旧码将失效）' : '生成恢复码' }}
        </button>
        <div v-if="recoveryCode" class="p-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-700 rounded break-all font-mono select-all">
          {{ recoveryCode }}
          <p class="text-yellow-600 dark:text-yellow-400 mt-1 font-sans">请抄写或打印保存，关闭后不再显示。</p>
          <p class="text-red-600 dark:text-red-400 mt-1 font-sans font-medium flex items-start gap-1.5"><AppIcon name="alert" :size="14" class-name="shrink-0 mt-0.5" /> <span>恢复码不存储在本地。一旦丢失且忘记主密码，所有加密数据将永久无法恢复。</span></p>
        </div>
      </div>

      <!-- 导出/导入 -->
      <div class="space-y-1">
        <p class="text-gray-500 dark:text-gray-400">备份使用当前数据库密钥整体加密，只能由相同记忆密码和身份密语打开。</p>
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

    <!-- 安全说明 -->
    <div class="border-t pt-3 space-y-2">
      <button @click="showSecurity = !showSecurity" class="w-full text-left font-medium text-gray-700 dark:text-gray-300 flex justify-between items-center">
        <span>安全说明</span>
        <AppIcon :name="showSecurity ? 'chevron-up' : 'chevron-down'" :size="12" class-name="text-gray-400" />
      </button>
      <div v-if="showSecurity" class="space-y-2 text-gray-500 dark:text-gray-400 leading-relaxed">
        <p class="font-medium text-gray-600 dark:text-gray-300">设计理念</p>
        <p class="text-[11px]">花钥无任何后端服务器，所有数据仅存于你的设备。同步时只上传加密密文，任何第三方均无法读取内容。</p>
        <p class="font-medium text-gray-600 dark:text-gray-300 pt-1">本地存储了什么</p>
        <table class="w-full text-[11px] border-collapse">
          <tr class="border-b dark:border-gray-700"><td class="py-1 pr-2 text-gray-400 whitespace-nowrap">区分代号/标题/描述</td><td>加密存储，解锁后才可读取</td></tr>
          <tr class="border-b dark:border-gray-700"><td class="py-1 pr-2 text-gray-400 whitespace-nowrap">网址/标签/类型</td><td>明文存储——本身不敏感，且未解锁时也能识别"此网站花钥已有密码"</td></tr>
          <tr class="border-b dark:border-gray-700"><td class="py-1 pr-2 text-gray-400 whitespace-nowrap">身份密语</td><td>AES-256-GCM 包装后存储，主密码解锁后才进入内存</td></tr>
          <tr><td class="py-1 pr-2 text-gray-400 whitespace-nowrap">verifyHash</td><td>带随机盐的验证值，仅用于校验主密码</td></tr>
        </table>
        <p class="font-medium text-gray-600 dark:text-gray-300 pt-1">从未存储</p>
        <ul class="list-disc list-inside text-[11px] space-y-0.5">
          <li>主密码本身</li>
          <li>网站实际密码——花钥从不主动保存，按需生成、用完即弃；如需存储固定密码，需由你手动选择，同样以 AES-256-GCM 加密保存</li>
          <li>数据库加密密钥（仅存于内存，锁定后立即清除）</li>
        </ul>
        <p class="font-medium text-gray-600 dark:text-gray-300 pt-1">不可变生成根</p>
        <p class="text-[11px]">主密码和身份密语共同决定全部历史生成密码，设置后不提供普通修改入口。恢复码只恢复原主密码。</p>
        <p class="font-medium text-gray-600 dark:text-gray-300 pt-1">加密算法</p>
        <p class="text-[11px]">AES-256-GCM 是目前最主流的对称加密标准，1Password、Bitwarden 等主流密码管理工具均采用此算法。花钥用它加密区分代号等敏感字段——但请注意，<span class="text-gray-600 dark:text-gray-300">单独的区分代号无法算出密码</span>，最终密码由"区分代号 + 你的记忆密码"共同决定。记忆密码只存在于你的脑中，从不上传、从不存储，密码的最终所有权永远属于你。</p>
        <p class="text-[11px] pt-0.5">密钥派生：PBKDF2（600,000 次迭代，SHA-256），基于浏览器原生 Web Crypto API，零外部依赖。</p>
        <p class="font-medium text-gray-600 dark:text-gray-300 pt-1">网络请求</p>
        <p class="text-[11px]">本插件仅向你配置的 WebDAV 地址发送请求，无任何遥测、无回调、无第三方服务。</p>
      </div>
    </div>

    <!-- 危险操作 -->
    <div class="border-t pt-3 space-y-2">
      <p class="font-medium text-gray-700 dark:text-gray-300">危险操作</p>
      <button @click="confirmClear" class="w-full py-1.5 border border-red-300 text-red-500 rounded hover:bg-red-50 dark:hover:bg-red-900/20">
        清除本地数据
      </button>
    </div>
    <ConfirmDialog :visible="confirmVisible" :title="confirmOpts.title" :message="confirmOpts.message"
      :confirm-text="confirmOpts.confirmText" :cancel-text="confirmOpts.cancelText" :danger="confirmOpts.danger"
      @confirm="onConfirm" @cancel="onCancel" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick } from 'vue';
import { useSyncStore } from '../stores/sync';
import { useMainStore } from '../stores/main';
import type { WebDAVConfig } from '@flowerkey/core';
import { db } from '@flowerkey/core';
import { useConfirm } from '../composables/useConfirm';
import { getImportEntryCount } from '../utils/import-preview';
import ConfirmDialog from './ConfirmDialog.vue';
import AppIcon from '../icons/AppIcon.vue';

const syncStore = useSyncStore();
const mainStore = useMainStore();
const { visible: confirmVisible, options: confirmOpts, ask, onConfirm, onCancel } = useConfirm();
const syncUrlInput = ref<HTMLInputElement | null>(null);

const form = ref<WebDAVConfig>({ url: '', username: '', password: '', basePath: '/FlowerKey' });

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
  const data = await db.getMasterData();
  hasRecovery.value = !!(data?.encryptedMasterPwd);
  lockTimeout.value = (await db.getConfig<number>('lockTimeout')) ?? 5;
  lockOnClose.value = (await db.getConfig<boolean>('lockOnClose')) ?? false;
});

async function focusSyncConfig() {
  await nextTick();
  syncUrlInput.value?.focus();
}

async function saveConfig() {
  if (!form.value.url || !form.value.username) return;
  await syncStore.saveConfig({ ...form.value });
}

const lockTimeout = ref(5);
const lockOnClose = ref(false);

async function saveLockTimeout() {
  await db.setConfig('lockTimeout', lockTimeout.value);
}
async function saveLockOnClose() {
  await db.setConfig('lockOnClose', lockOnClose.value);
}
// 方案一：恢复码
const recoveryCode = ref('');
const hasRecovery = ref(false);
async function handleGenerateRecovery() {
  if (hasRecovery.value && !await ask('生成新恢复码后，旧恢复码将立即失效，确认继续？', { title: '重新生成恢复码', danger: true })) return;
  recoveryCode.value = await mainStore.generateRecovery();
  hasRecovery.value = true;
}

// 导出/导入
const importMsg = ref('');
const showSecurity = ref(false);
const showDavGuide = ref(false);

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
}

async function confirmClear() {
  if (await ask('确定要清除所有本地数据吗？此操作不可恢复。', { title: '清除数据', danger: true })) {
    indexedDB.deleteDatabase('FlowerKeyDB');
    location.reload();
  }
}
</script>
