<!--
  花钥 Popup - 锁定态首屏与快速收藏
  默认展示首屏直算，书签模式在需要时再解锁收藏。
-->
<template>
  <div class="w-80 bg-white dark:bg-gray-900 dark:text-gray-100">
    <div class="px-4 py-3 border-b dark:border-gray-700 flex items-center justify-between">
      <h1 class="text-sm font-bold flex items-center gap-1"><img src="@ui/assets/key.png" class="w-4 h-4 object-contain" /> 花钥</h1>
      <div class="flex gap-3 text-xs text-gray-400">
        <button @click="mode = mode === 'bookmark' ? 'password' : 'bookmark'" class="hover:text-gray-600 dark:hover:text-gray-200">
          {{ mode === 'bookmark' ? '密码生成' : '收藏页面' }}
        </button>
        <button @click="openSidePanel" class="hover:text-gray-600 dark:hover:text-gray-200">管理面板</button>
      </div>
    </div>

    <div class="p-4">
      <Transition name="fade" mode="out-in">
        <OnboardingForm v-if="!mainStore.isSetup && !showSetup" @done="showSetup = true" />
        <SetupForm v-else-if="!mainStore.isSetup" @done="onSetupDone" />

        <!-- 锁定（密码模式或加密书签模式才需要解锁） -->
        <UnlockForm v-else-if="!mainStore.isUnlocked && mode === 'password'" @unlocked="onUnlocked" />

        <div v-else-if="!mainStore.isUnlocked && bookmarkEncrypt" class="space-y-3">
          <div class="rounded-2xl border border-blue-200/70 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 space-y-1 leading-relaxed">
            <p class="font-medium text-blue-800 dark:text-blue-200">先登入数据库再收藏加密书签</p>
            <p>当前书签模式开启了加密，需先解锁后才能保存页面内容。</p>
          </div>
          <UnlockForm @unlocked="onUnlocked" />
        </div>

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
          <div v-if="!codename && !generatedPwd" class="rounded-2xl border border-blue-200/70 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-900/20 px-3 py-2 text-xs text-blue-700 dark:text-blue-300 space-y-1.5 leading-relaxed">
            <p class="font-medium text-blue-800 dark:text-blue-200">快速生成</p>
            <p>输入一个区分代号，例如 github-main。</p>
            <p>生成后会自动复制，直接回到网站粘贴即可。</p>
          </div>
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
          <div v-if="generatedPwd" class="p-2 bg-gray-50 dark:bg-gray-800 rounded flex items-center justify-between">
            <code class="text-sm break-all">{{ generatedPwd.length <= 10 ? generatedPwd : generatedPwd.slice(0,5) + '•••••' + generatedPwd.slice(-5) }}</code>
            <button @click="copyPwd" class="ml-2 text-xs text-blue-500 hover:underline shrink-0">
              {{ copied ? '已复制' : '复制' }}
            </button>
          </div>
          <button @click="mainStore.lock()" class="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">锁定</button>
        </div>
      </Transition>
    </div>
    <Toast :visible="toast.visible.value" :message="toast.message.value" :type="toast.type.value" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useMainStore } from '../../ui/src/stores/main';
import { useEntriesStore } from '../../ui/src/stores/entries';
import { useSyncStore } from '../../ui/src/stores/sync';
import { useToast } from '../../ui/src/composables/useToast';
import { db, type CharsetMode } from '@flowerkey/core';
import OnboardingForm from '../../ui/src/components/OnboardingForm.vue';
import SetupForm from '../../ui/src/components/SetupForm.vue';
import UnlockForm from '../../ui/src/components/UnlockForm.vue';
import Toast from '../../ui/src/components/Toast.vue';

const mainStore = useMainStore();
const entriesStore = useEntriesStore();
const syncStore = useSyncStore();
const toast = useToast();
const showSetup = ref(false);

const mode = ref<'bookmark' | 'password'>('password');

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

watch([codename, charsetMode, pwdLength], async ([c]) => {
  if (mainStore.isUnlocked && (c as string).trim()) {
    const res = await chrome.runtime.sendMessage({ type: 'generatePassword', codename: c, mode: charsetMode.value, length: pwdLength.value });
    generatedPwd.value = res?.password || '';
  } else {
    generatedPwd.value = '';
  }
});

onMounted(async () => {
  await mainStore.checkSetup();
  bookmarkEncrypt.value = (await db.getConfig<boolean>('bookmarkEncrypt')) ?? true;
  // 通过 background 恢复解锁状态，masterPwd 不经过 storage
  const state = await chrome.runtime.sendMessage({ type: 'getUnlockState' });
  if (state?.isUnlocked) {
    const restored = await chrome.runtime.sendMessage({ type: 'restoreDbKey' });
    if (restored?.ok) {
      mainStore.userSalt = restored.userSalt;
      mainStore.isUnlocked = true;
    }
  }
  // 无论是否解锁，都加载页面元数据（不加密书签无需解锁）
  if (mainStore.isSetup) await init();
});

// 监听解锁状态变化，同步到 background 并加载页面信息
watch(() => mainStore.isUnlocked, async (unlocked) => {
  if (unlocked && mainStore.masterPwd) {
    await chrome.runtime.sendMessage({ type: 'setUnlocked', masterPwd: mainStore.masterPwd, userSalt: mainStore.userSalt });
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

async function onUnlocked() {
  if (mode.value === 'bookmark') {
    await init();
  }
}

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
    toast.show('书签已收藏', 'success');
    setTimeout(() => window.close(), 1200);
  } catch (e) {
    saveError.value = (e as Error).message;
  } finally { saving.value = false; }
}

async function generate() {
  if (!codename.value.trim()) return;
  generatedPwd.value = await mainStore.genPassword(codename.value, charsetMode.value, pwdLength.value);
  await copyPwd();
}

async function copyPwd() {
  if (!generatedPwd.value) return;
  await navigator.clipboard.writeText(generatedPwd.value);
  const all = await db.getEntriesByType('password');
  const matched = all.find(e => e.codename === codename.value.trim());
  if (matched?.id) await db.touchLastUsed(matched.id);
  copied.value = true;
  toast.show('密码已复制到剪贴板', 'success');
  setTimeout(() => (copied.value = false), 1500);
}

async function openSidePanel() {
  const [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tab?.windowId) await chrome.sidePanel.open({ windowId: tab.windowId });
  window.close();
}
</script>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
