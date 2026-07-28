<!--
  花钥移动端 - 设置 Tab
  同步配置（WebDAV / iCloud）+ 账户安全（恢复原主密码/导出导入）
-->
<template>
  <div class="h-full overflow-y-auto px-4 py-4 flex flex-col gap-4">

    <!-- 数据安全警告 -->
    <div v-if="!syncStore.hasBackend()"
      class="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-300 dark:border-orange-700 rounded-xl text-orange-700 dark:text-orange-300 text-sm space-y-2">
      <p class="flex items-start gap-1.5"><AppIcon name="alert" :size="14" class-name="shrink-0 mt-0.5" /> <span>卸载应用或换设备将永久丢失所有数据，请配置同步或定期导出备份。</span></p>
      <button @click="focusSyncConfig" class="w-full py-2.5 rounded-xl border border-orange-300/80 bg-white/70 text-orange-700 text-sm hover:bg-white dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-200 dark:hover:bg-orange-950/50">
        立即配置同步
      </button>
    </div>

    <p class="text-xs font-medium text-gray-400 dark:text-gray-500 px-1">同步</p>

    <!-- 自动填充（Android） -->
    <div v-if="isAndroid" class="bg-white dark:bg-gray-800 rounded-xl divide-y dark:divide-gray-700">
      <div class="px-4 py-3 flex items-center justify-between">
        <div>
          <p class="text-sm font-medium dark:text-gray-100">自动填充服务</p>
          <p class="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{{ autofillEnabled ? '已启用，点击密码框可自动填充' : '未启用，点击开启' }}</p>
        </div>
        <button @click="openAutofillSettings"
          :class="['px-3 py-1.5 rounded-lg text-sm', autofillEnabled ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-blue-500 text-white']">
          {{ autofillEnabled ? '已启用' : '去开启' }}
        </button>
      </div>
    </div>

    <!-- 同步配置 -->
    <div class="bg-white dark:bg-gray-800 rounded-xl">
      <button @click="showSyncConfig = !showSyncConfig" class="w-full px-4 py-3 flex items-center justify-between text-sm font-medium dark:text-gray-100">
        <span>同步配置</span>
        <div class="flex items-center gap-2">
          <span class="text-xs text-gray-400 dark:text-gray-500">{{ syncStatusText }}</span>
          <span class="text-gray-400 dark:text-gray-500">{{ showSyncConfig ? '▲' : '▼' }}</span>
        </div>
      </button>
      <div v-if="showSyncConfig" class="border-t dark:border-gray-700 divide-y dark:divide-gray-700">
      <!-- 同步方式选择 -->
      <div class="px-4 py-3">
        <p class="text-sm font-medium dark:text-gray-100 mb-2">同步方式</p>
        <p class="text-xs text-gray-400 dark:text-gray-500 mb-2">WebDAV 可与浏览器插件互通；iCloud 仅限 iOS 设备间同步。</p>
        <div class="flex gap-2">
          <button @click="syncStore.setSyncMode('webdav')"
            :class="['flex-1 py-2 rounded-xl text-sm border', syncStore.syncMode === 'webdav' ? 'bg-gray-800 text-white border-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100' : 'border-gray-300 dark:border-gray-600 dark:text-gray-300']">
            WebDAV
          </button>
          <button @click="syncStore.setSyncMode('icloud')"
            :class="['flex-1 py-2 rounded-xl text-sm border', syncStore.syncMode === 'icloud' ? 'bg-gray-800 text-white border-gray-800 dark:bg-gray-100 dark:text-gray-900 dark:border-gray-100' : 'border-gray-300 dark:border-gray-600 dark:text-gray-300']">
             iCloud
          </button>
        </div>
      </div>

      <!-- WebDAV 配置表单 -->
      <div v-if="syncStore.syncMode === 'webdav'" class="px-4 py-3 flex flex-col gap-2">
        <input ref="syncUrlInput" v-model="form.url" placeholder="服务器地址" class="input" />
        <input v-model="form.username" placeholder="用户名" class="input" />
        <input v-model="form.password" type="password" placeholder="密码" class="input" />
        <input v-model="form.basePath" placeholder="同步目录（默认 /FlowerKey）" class="input" />
        <button @click="saveConfig" class="w-full py-2.5 bg-gray-800 dark:bg-gray-100 dark:text-gray-900 text-white rounded-xl text-sm">保存配置</button>
        <!-- 坚果云教程 -->
        <button @click="showDavGuide = !showDavGuide" class="text-left text-xs text-blue-500">
          {{ showDavGuide ? '▲ 收起' : '▼ 如何配置坚果云？' }}
        </button>
        <div v-if="showDavGuide" class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex flex-col gap-1.5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          <p class="font-medium">坚果云配置步骤</p>
          <p>① 登录坚果云网页版 → 右上角头像 → <b>账户信息</b> → <b>安全选项</b></p>
          <p>② 找到「第三方应用管理」→ <b>添加应用</b>，名称随意，点击<b>生成密码</b></p>
          <p>③ 回到花钥，填写：</p>
          <p class="font-mono text-[11px] bg-white dark:bg-gray-700 rounded p-2">服务器：https://dav.jianguoyun.com/dav/<br/>用户名：坚果云注册邮箱<br/>密码：刚才生成的应用密码</p>
          <p class="text-gray-400 dark:text-gray-500 flex items-start gap-1.5"><AppIcon name="lock" :size="14" class-name="shrink-0 mt-0.5" /> <span>花钥只上传加密密文，坚果云无法读取任何内容。你的主密码永远不会离开设备。</span></p>
        </div>
      </div>

      <!-- iCloud 说明 -->
      <div v-else class="px-4 py-3 flex flex-col gap-2">
        <p class="text-xs text-gray-500 dark:text-gray-400">数据将同步至 iCloud Drive / FlowerKey 目录，无需账号密码，开箱即用。</p>
        <button @click="showICloudGuide = !showICloudGuide" class="text-left text-xs text-blue-500">
          {{ showICloudGuide ? '▲ 收起' : '▼ 使用前请确认' }}
        </button>
        <div v-if="showICloudGuide" class="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex flex-col gap-1.5 text-xs text-gray-600 dark:text-gray-300 leading-relaxed">
          <p class="font-medium">iCloud 同步前提</p>
          <p>① 设置 → 顶部账户 → iCloud → 确认已开启 <b>iCloud Drive</b></p>
          <p>② 设置 → 顶部账户 → iCloud → 向下找到花钥，确认已开启同步开关</p>
          <p>③ 多设备同步时，所有设备均需登录<b>同一 Apple ID</b></p>
          <p class="text-gray-400 dark:text-gray-500 flex items-start gap-1.5"><AppIcon name="lock" :size="14" class-name="shrink-0 mt-0.5" /> <span>花钥只上传加密密文，Apple 无法读取任何内容。你的主密码永远不会离开设备。</span></p>
        </div>
      </div>

      <!-- 同步操作 -->
      <div class="px-4 py-3 flex flex-col gap-2">
        <button @click="syncStore.sync()" :disabled="syncStore.syncing || !syncStore.hasBackend()"
          class="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm disabled:opacity-50 flex items-center justify-center gap-2">
          <svg v-if="syncStore.syncing" class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>{{ syncStore.syncing ? '同步中...' : '立即同步' }}</span>
        </button>
        <button @click="handleFullSync" :disabled="syncStore.syncing || !syncStore.hasBackend()"
          class="w-full py-2.5 border border-gray-300 dark:border-gray-600 dark:text-gray-300 rounded-xl text-sm disabled:opacity-50">
          全量同步（重新上传所有数据）
        </button>
        <p v-if="syncStore.hasBackend()" class="text-xs text-gray-500 dark:text-gray-400 text-center">
          {{ syncStore.lastSyncTime ? `最近一次成功同步：${formatSyncTime(syncStore.lastSyncTime)}` : '尚未完成过成功同步，可点击“立即同步”验证当前配置。' }}
        </p>
        <p v-if="syncStore.lastResult" class="text-xs text-gray-500 dark:text-gray-400 text-center">
          本次结果：推送 {{ syncStore.lastResult.pushed }} 条，拉取 {{ syncStore.lastResult.pulled }} 条
        </p>
        <p v-if="syncStore.lastResult?.encryptMismatch" class="text-xs text-orange-600 dark:text-orange-400 text-center flex items-start justify-center gap-1.5">
          <AppIcon name="alert" :size="14" class-name="shrink-0 mt-0.5" />
          <span>{{ syncStore.lastResult.encryptMismatch }} 条书签因加密设置与其他设备不一致被跳过，请统一所有设备的书签加密设置后重新同步。</span>
        </p>
        <p v-if="syncStore.error" class="text-xs text-red-500 text-center">{{ syncStore.error }}</p>
      </div>
      </div>
    </div>

    <p class="text-xs font-medium text-gray-400 dark:text-gray-500 px-1">安全</p>
    <button @click="showSafetySettings = !showSafetySettings" :aria-expanded="showSafetySettings" class="w-full px-4 py-3 flex items-center justify-between rounded-xl bg-white dark:bg-gray-800 text-sm font-medium dark:text-gray-100">
      <span>安全与恢复</span><span class="text-gray-400">{{ showSafetySettings ? '收起' : '展开' }}</span>
    </button>
    <div v-if="showSafetySettings" class="flex flex-col gap-4">

    <div class="bg-white dark:bg-gray-800 rounded-xl px-4 py-3 flex flex-col gap-2">
      <p class="text-sm font-medium dark:text-gray-100">身份密语提示</p>
      <p class="text-xs text-gray-500 dark:text-gray-400">仅用于你登录后区分自己使用的身份密语，不参与生成，也不能恢复密语。</p>
      <input v-model="identityHintDraft" placeholder="填写提示，不要写出身份密语本身" maxlength="120" class="input" />
      <button @click="saveIdentityHint" :disabled="!identityHintDraft.trim()" class="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm disabled:opacity-50">保存提示</button>
      <p v-if="identityHintMessage" class="text-xs text-green-600 dark:text-green-400">{{ identityHintMessage }}</p>
    </div>

    <!-- 书签设置 -->
    <div v-if="false" class="bg-white dark:bg-gray-800 rounded-xl divide-y dark:divide-gray-700">
      <div class="px-4 py-3 flex flex-col gap-2">
        <p class="text-sm font-medium dark:text-gray-100">书签设置</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">
          当前：书签{{ bookmarkEncrypt ? '已加密' : '未加密' }}。
          {{ bookmarkEncrypt ? '关闭后将解密所有书签，无需解锁即可查看。' : '开启后将加密所有书签，查看需要解锁。' }}
        </p>
        <p class="text-xs text-gray-400 dark:text-gray-500">多设备使用时，请确保所有设备的书签加密设置一致，否则同步时不一致的书签将被跳过。</p>
        <div v-if="!bookmarkEncrypt" class="rounded-xl border border-orange-200/80 bg-orange-50/80 px-3 py-2 text-xs text-orange-700 dark:border-orange-800/70 dark:bg-orange-900/20 dark:text-orange-300 flex flex-col gap-1.5">
          <p class="flex items-start gap-1.5"><AppIcon name="alert" :size="14" class-name="shrink-0 mt-0.5" /> <span>书签当前以明文存储于本地，任何能访问应用数据的程序均可读取。</span></p>
          <button @click="showBookmarkPwdInput = true" class="w-full py-2.5 rounded-xl border border-orange-300/80 bg-white/80 text-orange-700 text-sm hover:bg-white dark:border-orange-700 dark:bg-orange-950/30 dark:text-orange-200 dark:hover:bg-orange-950/50">
            立即开启书签加密
          </button>
        </div>
        <div v-if="!showBookmarkPwdInput">
          <button @click="showBookmarkPwdInput = true" class="w-full py-2.5 border dark:border-gray-600 dark:text-gray-300 rounded-xl text-sm">
            {{ bookmarkEncrypt ? '关闭书签加密' : '开启书签加密' }}
          </button>
        </div>
        <div v-else class="flex flex-col gap-2">
          <p class="text-xs text-yellow-600 dark:text-yellow-400">请输入主密码以确认操作：</p>
          <input v-model="bookmarkPwdInput" type="password" placeholder="主密码" class="input" />
          <div class="flex gap-2">
            <button @click="confirmBookmarkEncrypt" :disabled="bookmarkEncryptProcessing" class="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm disabled:opacity-50">
              {{ bookmarkEncryptProcessing ? '处理中...' : '确认' }}
            </button>
            <button @click="cancelBookmarkEncrypt" class="flex-1 py-2.5 border dark:border-gray-600 dark:text-gray-300 rounded-xl text-sm">取消</button>
          </div>
          <p v-if="bookmarkEncryptError" class="text-xs text-red-500">{{ bookmarkEncryptError }}</p>
        </div>
      </div>
    </div>

    <!-- 账户安全 -->
    <div class="bg-white dark:bg-gray-800 rounded-xl divide-y dark:divide-gray-700">
      <!-- 恢复码 -->
      <div class="px-4 py-3 flex flex-col gap-2">
        <p class="text-sm font-medium dark:text-gray-100">恢复码</p>
        <p class="text-xs text-gray-500 dark:text-gray-400">恢复码会还原原主密码并直接解锁，不会改变历史生成密码。请妥善保管。</p>
        <div v-if="!hasRecovery" class="rounded-xl border border-blue-200/70 bg-blue-50/70 px-3 py-2 text-xs text-blue-700 dark:border-blue-800/70 dark:bg-blue-900/20 dark:text-blue-200 flex flex-col gap-1.5">
          <p class="font-medium">建议现在就生成恢复码</p>
          <p class="leading-relaxed">这是忘记主密码后唯一可用的自救方式，生成后请离线抄写保存。</p>
          <button @click="handleGenerateRecovery" class="w-full py-2.5 rounded-xl border border-blue-200 bg-white/80 text-blue-700 text-sm hover:bg-white dark:border-blue-700 dark:bg-blue-950/30 dark:text-blue-200 dark:hover:bg-blue-950/50">
            立即生成恢复码
          </button>
        </div>
        <button @click="handleGenerateRecovery" class="w-full py-2.5 border dark:border-gray-600 dark:text-gray-300 rounded-xl text-sm">{{ hasRecovery ? '重新生成恢复码（旧码将失效）' : '生成新恢复码' }}</button>
        <div v-if="recoveryCode" class="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-300 dark:border-yellow-700 rounded-xl break-all font-mono text-xs select-all dark:text-gray-200">
          {{ recoveryCode }}
          <p class="text-yellow-600 dark:text-yellow-400 mt-1 font-sans">请抄写保存，关闭后不再显示。</p>
          <p class="text-red-600 dark:text-red-400 mt-1 font-sans font-medium flex items-start gap-1.5"><AppIcon name="alert" :size="14" class-name="shrink-0 mt-0.5" /> <span>恢复码不存储在本地。一旦丢失且忘记主密码，所有加密数据将永久无法恢复。</span></p>
        </div>
      </div>

      <!-- 导出/导入 -->
      <div class="px-4 py-3 flex flex-col gap-2">
        <p class="text-sm font-medium dark:text-gray-100">备份</p>
        <div class="flex gap-2">
          <button @click="handleExport" class="flex-1 py-2.5 border dark:border-gray-600 dark:text-gray-300 rounded-xl text-sm">导出备份</button>
          <label class="flex-1 py-2.5 border dark:border-gray-600 dark:text-gray-300 rounded-xl text-sm text-center cursor-pointer">
            导入备份
            <input type="file" accept=".json" class="hidden" @change="handleImport" />
          </label>
        </div>
        <p v-if="importMsg" class="text-xs text-green-600 dark:text-green-400 text-center">{{ importMsg }}</p>
        <label v-if="false" class="w-full py-2.5 border dark:border-gray-600 dark:text-gray-300 rounded-xl text-sm text-center cursor-pointer">
          导入浏览器书签（HTML）
          <input type="file" accept=".html" class="hidden" @change="handleImportBookmarks" />
        </label>
        <p v-if="importBookmarkMsg" class="text-xs text-green-600 dark:text-green-400 text-center">{{ importBookmarkMsg }}</p>
      </div>
    </div>
    </div>

    <p class="text-xs font-medium text-gray-400 dark:text-gray-500 px-1">关于</p>

    <!-- 安全说明 -->
    <div class="bg-white dark:bg-gray-800 rounded-xl">
      <button @click="showSecurity = !showSecurity" class="w-full px-4 py-3 flex items-center justify-between text-sm font-medium dark:text-gray-100">
        <span>安全说明</span>
        <span class="text-gray-400 dark:text-gray-500">{{ showSecurity ? '▲' : '▼' }}</span>
      </button>
      <div v-if="showSecurity" class="px-4 pb-4 flex flex-col gap-2 text-xs text-gray-500 dark:text-gray-400 leading-relaxed">
        <p class="text-gray-600 dark:text-gray-300 font-medium">与主流密码管理器的本质区别</p>
        <p>主流密码管理器的逻辑：生成随机密码 → 加密存储 → 云端备份。加密密码库始终存在于某处，一旦被盗，你的一切都暴露了。</p>
        <p>花钥的逻辑：记忆密码 + 身份密语 + 区分代号 → 算法推算 → 唯一强密码。<span class="text-gray-700 dark:text-gray-200">密码按需生成，用完即弃；三项输入不变即可离线重建。</span></p>
        <p class="text-gray-600 dark:text-gray-300 font-medium pt-1">本地存储了什么</p>
        <p><span class="text-gray-400 dark:text-gray-500">区分代号/标题/描述</span>　AES-256-GCM 加密，解锁后才可读取</p>
        <p><span class="text-gray-400 dark:text-gray-500">网址/包名/标签</span>　明文存储——本身不敏感，且未解锁时也能识别"此网站花钥已有密码"</p>
        <p><span class="text-gray-400 dark:text-gray-500">身份密语</span>　AES-256-GCM 包装后存储，主密码解锁后才进入内存</p>
        <p><span class="text-gray-400 dark:text-gray-500">verifyHash</span>　带随机盐的验证值，仅用于校验主密码</p>
        <p class="text-gray-600 dark:text-gray-300 font-medium pt-1">从未存储</p>
        <p>主密码本身 · 网站实际密码（按需生成，用完即弃）· 数据库加密密钥（仅存于内存，锁定后立即清除）</p>
        <p class="text-gray-600 dark:text-gray-300 font-medium pt-1">不可变生成根</p>
        <p>主密码和身份密语共同决定全部历史生成密码，设置后不提供普通修改入口。恢复码只恢复原主密码。</p>
        <p class="text-gray-600 dark:text-gray-300 font-medium pt-1">同步安全</p>
        <p>同步时只上传加密密文，坚果云、iCloud 等服务商无法读取任何内容。你的主密码永远不会离开设备。</p>
      </div>
    </div>

    <!-- 版本 + 锁定 -->
    <div class="bg-white dark:bg-gray-800 rounded-xl">
      <div class="px-4 py-3 flex items-center justify-between">
        <span class="text-sm text-gray-400 dark:text-gray-500">版本 {{ appVersion }}</span>
        <button @click="$emit('lock')" class="text-sm text-red-500 dark:text-red-400">锁定</button>
      </div>
    </div>
    <ConfirmDialog :visible="confirmVisible" :title="confirmOpts.title" :message="confirmOpts.message"
      :confirm-text="confirmOpts.confirmText" :cancel-text="confirmOpts.cancelText" :danger="confirmOpts.danger"
      @confirm="onConfirm" @cancel="onCancel" />
    <Toast :visible="toast.visible.value" :message="toast.message.value" :type="toast.type.value" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed, nextTick } from 'vue';
import { version } from '../../package.json';
import { useMainStore } from '../stores/main';
import { useSyncStore } from '../stores/sync';
import * as sqliteDb from '../db-sqlite';
import type { WebDAVConfig } from '@flowerkey/core';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { useConfirm } from '../../../ui/src/composables/useConfirm';
import { useToast } from '../../../ui/src/composables/useToast';
import { getImportEntryCount } from '../../../ui/src/utils/import-preview';
import ConfirmDialog from '../../../ui/src/components/ConfirmDialog.vue';
import Toast from '../../../ui/src/components/Toast.vue';
import AppIcon from '../../../ui/src/icons/AppIcon.vue';

const appVersion = version;

const AutofillState = registerPlugin<{
  checkEnabled(): Promise<{ enabled: boolean }>;
  openSettings(): Promise<void>;
}>('AutofillState');

defineEmits<{ lock: [] }>();

const mainStore = useMainStore();
const syncStore = useSyncStore();
const { visible: confirmVisible, options: confirmOpts, ask, onConfirm, onCancel } = useConfirm();
const syncUrlInput = ref<HTMLInputElement | null>(null);
const toast = useToast();
const form = ref<WebDAVConfig>({ url: '', username: '', password: '', basePath: '/FlowerKey' });
const showDavGuide = ref(false);
const showICloudGuide = ref(false);
const showSecurity = ref(false);
const showSafetySettings = ref(true);
const showSyncConfig = ref(false);
const syncStatusText = computed(() => syncStore.hasBackend() ? (syncStore.syncMode === 'webdav' ? 'WebDAV' : 'iCloud') : '未配置');
const isAndroid = Capacitor.getPlatform() === 'android';
const autofillEnabled = ref(false);
const identityHintDraft = ref('');
const identityHintMessage = ref('');

function formatSyncTime(ts: number) {
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(ts));
}

async function focusSyncConfig() {
  showSyncConfig.value = true;
  await nextTick();
  syncUrlInput.value?.focus();
}

async function openAutofillSettings() {
  await AutofillState.openSettings().catch(() => {});
  // 返回后重新检测状态
  setTimeout(async () => {
    const r = await AutofillState.checkEnabled().catch(() => ({ enabled: false }));
    autofillEnabled.value = r.enabled;
  }, 500);
}

onMounted(async () => {
  await syncStore.loadConfig();
  if (syncStore.config) Object.assign(form.value, syncStore.config);
  showSyncConfig.value = !syncStore.hasBackend();
  bookmarkEncrypt.value = (await sqliteDb.getConfig<boolean>('bookmarkEncrypt')) ?? true;
  identityHintDraft.value = mainStore.identityHint;
  const data = await sqliteDb.getMasterData();
  hasRecovery.value = !!(data?.encryptedMasterPwd);
  if (isAndroid) {
    const r = await AutofillState.checkEnabled().catch(() => ({ enabled: false }));
    autofillEnabled.value = r.enabled;
  }
});

async function handleFullSync() {
  if (!await ask('将重新上传所有本地数据到远端，确认继续？', { title: '全量同步', danger: true })) return;
  await syncStore.fullSync();
}

async function saveIdentityHint() {
  try { await mainStore.saveIdentityHint(identityHintDraft.value); identityHintMessage.value = '已保存到本机'; }
  catch { identityHintMessage.value = '保存失败，请重试'; }
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
    await sqliteDb.setBookmarkEncryption(newVal);
    await sqliteDb.setConfig('bookmarkEncrypt', newVal);
    bookmarkEncrypt.value = newVal;
    cancelBookmarkEncrypt();
  } finally {
    bookmarkEncryptProcessing.value = false;
  }
}

const recoveryCode = ref('');
const hasRecovery = ref(false);
async function handleGenerateRecovery() {
  const data = await sqliteDb.getMasterData();
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
  try {
    const text = await file.text();
    const total = getImportEntryCount(text);
    const count = await mainStore.importData(text);
    importMsg.value = buildImportSummary(count, total, '条备份条目');
    toast.show(importMsg.value, 'success');
  } catch { toast.show('导入失败，请检查备份文件格式', 'error'); }
  (e.target as HTMLInputElement).value = '';
}

async function handleImportBookmarks(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  try {
    const html = await file.text();
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const links = Array.from(doc.querySelectorAll('a[href]'));
    const items = links.map(a => ({
      title: a.textContent?.trim() || a.getAttribute('href') || '',
      url: a.getAttribute('href') || '',
      favicon: a.getAttribute('icon') || undefined,
    })).filter(i => i.url.startsWith('http'));
    const encrypt = (await sqliteDb.getConfig<boolean>('bookmarkEncrypt')) ?? true;
    const count = await sqliteDb.importBookmarks(items, encrypt);
    importBookmarkMsg.value = buildImportSummary(count, items.length, '条书签');
    toast.show(importBookmarkMsg.value, 'success');
  } catch { toast.show('书签导入失败，请检查 HTML 文件', 'error'); }
  (e.target as HTMLInputElement).value = '';
}
</script>
