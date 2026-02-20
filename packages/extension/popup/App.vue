<!--
  花钥 Popup - 快速收藏当前页
  解锁后自动识别当前页元数据，一键保存书签并同步 WebDAV
-->
<template>
  <div class="w-80 bg-white dark:bg-gray-900 dark:text-gray-100">
    <div class="px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between">
      <h1 class="text-sm font-bold">🔑 花钥</h1>
      <div class="flex gap-3 text-xs text-gray-400">
        <button @click="mode = mode === 'bookmark' ? 'password' : 'bookmark'" class="hover:text-gray-600 dark:hover:text-gray-200">
          {{ mode === 'bookmark' ? '密码生成' : '收藏页面' }}
        </button>
        <button @click="openSidePanel" class="hover:text-gray-600 dark:hover:text-gray-200">管理面板</button>
      </div>
    </div>

    <div class="p-4">
      <!-- 未设置 -->
      <SetupForm v-if="!mainStore.isSetup" @done="onSetupDone" />

      <!-- 锁定（密码模式或加密书签模式才需要解锁） -->
      <UnlockForm v-else-if="!mainStore.isUnlocked && (mode === 'password' || bookmarkEncrypt)" @unlocked="onUnlocked" />

      <!-- 书签收藏模式（已解锁，或不加密时无需解锁） -->
      <div v-else-if="mode === 'bookmark'" class="space-y-2">
        <!-- 页面预览 -->
        <div class="flex gap-2 items-start p-2 bg-gray-50 dark:bg-gray-800 rounded">
          <img v-if="meta.favicon" :src="meta.favicon" class="w-4 h-4 mt-0.5 shrink-0" @error="(e) => (e.target as HTMLImageElement).style.display='none'" />
          <div class="min-w-0">
            <p class="text-xs font-medium truncate">{{ meta.title || '加载中...' }}</p>
            <p class="text-xs text-gray-400 truncate">{{ meta.url }}</p>
          </div>
        </div>

        <!-- og:image 预览 -->
        <img v-if="meta.image" :src="meta.image" class="w-full h-24 object-cover rounded" @error="(e) => (e.target as HTMLImageElement).style.display='none'" />

        <input v-model="form.title" placeholder="标题" class="input" />
        <input v-model="form.description" placeholder="备注（可选）" class="input" />

        <div class="flex gap-2">
          <input v-model="form.folder" placeholder="文件夹" class="input flex-1" list="folders-list" />
          <datalist id="folders-list">
            <option v-for="f in folders" :key="f" :value="f" />
          </datalist>
          <input v-model="tagsInput" placeholder="标签（逗号分隔）" class="input flex-1" />
        </div>

        <button @click="saveBookmark" :disabled="saving || !form.title"
          class="w-full py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50">
          {{ saving ? '保存中...' : saved ? '✓ 已收藏' : '收藏' }}
        </button>
        <p v-if="saveError" class="text-xs text-red-500 text-center">{{ saveError }} <button @click="saveBookmark" class="underline">重试</button></p>
        <p v-if="initError" class="text-xs text-red-400 text-center break-all">{{ initError }}</p>
      </div>

      <!-- 已解锁：密码生成模式 -->
      <div v-else class="space-y-3">
        <input v-model="codename" placeholder="输入区分代号" class="input" @keyup.enter="generate" />
        <div class="flex gap-2">
          <select v-model="charsetMode" class="flex-1 px-2 py-2 border rounded text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            <option value="alphanumeric">字母+数字</option>
            <option value="with_symbols">含特殊字符</option>
          </select>
          <select v-model.number="pwdLength" class="w-20 px-2 py-2 border rounded text-sm dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100">
            <option :value="8">8位</option>
            <option :value="16">16位</option>
            <option :value="24">24位</option>
            <option :value="32">32位</option>
          </select>
        </div>
        <button @click="generate" :disabled="!codename.trim()"
          class="w-full py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50">
          生成密码
        </button>
        <div v-if="generatedPwd" class="p-2 bg-gray-50 dark:bg-gray-800 rounded flex items-center justify-between">
          <code class="text-sm break-all">{{ generatedPwd }}</code>
          <button @click="copyPwd" class="ml-2 text-xs text-blue-500 hover:underline shrink-0">
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
        <button @click="mainStore.lock()" class="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">锁定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, nextTick, watch } from 'vue';
import { useMainStore } from '../../ui/src/stores/main';
import { useEntriesStore } from '../../ui/src/stores/entries';
import { useSyncStore } from '../../ui/src/stores/sync';
import { db, deriveDatabaseKey, type CharsetMode } from '@flowerkey/core';
import SetupForm from '../../ui/src/components/SetupForm.vue';
import UnlockForm from '../../ui/src/components/UnlockForm.vue';

const mainStore = useMainStore();
const entriesStore = useEntriesStore();
const syncStore = useSyncStore();

const mode = ref<'bookmark' | 'password'>('bookmark');

// 页面元数据
const meta = ref({ title: '', url: '', favicon: '', image: '', description: '' });
const form = ref({ title: '', description: '', folder: '', url: '' });
const tagsInput = ref('');
const folders = ref<string[]>([]);
const bookmarkEncrypt = ref(true);
const saving = ref(false);
const saved = ref(false);
const saveError = ref('');
const initError = ref('');

// 密码生成
const codename = ref('');
const charsetMode = ref<CharsetMode>('alphanumeric');
const pwdLength = ref(16);
const generatedPwd = ref('');
const copied = ref(false);

onMounted(async () => {
  await mainStore.checkSetup();
  bookmarkEncrypt.value = (await db.getConfig<boolean>('bookmarkEncrypt')) ?? true;
  const session = await chrome.storage.session.get(['isUnlocked', 'masterPwd', 'userSalt']);
  if (session.isUnlocked && session.masterPwd) {
    mainStore.masterPwd = session.masterPwd;
    mainStore.userSalt = session.userSalt;
    mainStore.isUnlocked = true;
    db.setDbKey(await deriveDatabaseKey(session.masterPwd, session.userSalt));
  }
  // 无论是否解锁，都加载页面元数据（不加密书签无需解锁）
  if (mainStore.isSetup) await init();
});

// 监听解锁状态变化，写入 session 并加载页面信息
watch(() => mainStore.isUnlocked, async (unlocked) => {
  if (unlocked) {
    await chrome.storage.session.set({ isUnlocked: true, masterPwd: mainStore.masterPwd, userSalt: mainStore.userSalt });
    await init();
  }
});

async function init() {
  try {
    const data = await chrome.runtime.sendMessage({ type: 'getPageMeta' });
    if (data?.url) {
      meta.value = data;
      form.value.title = data.title || '';
      form.value.url = data.url || '';
      form.value.description = data.description || '';
    }
  } catch (e) {
    initError.value = (e as Error).message;
  }
  folders.value = await db.getAllFolders();
  await syncStore.loadConfig();
}

function onSetupDone() {}
function onUnlocked() {}

async function saveBookmark() {
  saving.value = true; saveError.value = '';
  try {
    const existing = await db.getBookmarkByUrl(form.value.url);
    if (existing) { saveError.value = '该网址已收藏'; return; }
    const tags = tagsInput.value ? tagsInput.value.split(',').map(t => t.trim()).filter(Boolean) : [];
    await entriesStore.createEntry({
      type: 'bookmark',
      title: form.value.title,
      url: form.value.url,
      favicon: meta.value.favicon,
      description: form.value.description,
      folder: form.value.folder,
      tags,
      encrypted: bookmarkEncrypt.value ? undefined : false,
    });
    // 触发 WebDAV 同步
    if (syncStore.config) syncStore.sync().catch(() => {});
    saved.value = true;
    setTimeout(() => window.close(), 1200);
  } catch (e) {
    saveError.value = (e as Error).message;
  } finally { saving.value = false; }
}

async function generate() {
  if (!codename.value.trim()) return;
  generatedPwd.value = await mainStore.genPassword(codename.value, charsetMode.value, pwdLength.value);
}

async function copyPwd() {
  await navigator.clipboard.writeText(generatedPwd.value);
  copied.value = true;
  setTimeout(() => (copied.value = false), 1500);
}

async function openSidePanel() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
  window.close();
}
</script>

<style scoped>
.input { @apply w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-400; }
</style>
