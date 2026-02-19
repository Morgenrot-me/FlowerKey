<!--
  花钥 Popup - 快速收藏当前页
  解锁后自动识别当前页元数据，一键保存书签并同步 WebDAV
-->
<template>
  <div class="w-80 bg-white">
    <div class="px-4 py-3 border-b flex items-center justify-between">
      <h1 class="text-sm font-bold">🔑 花钥</h1>
      <div class="flex gap-3 text-xs text-gray-400">
        <button @click="mode = mode === 'bookmark' ? 'password' : 'bookmark'" class="hover:text-gray-600">
          {{ mode === 'bookmark' ? '密码生成' : '收藏页面' }}
        </button>
        <button @click="openSidePanel" class="hover:text-gray-600">管理面板</button>
      </div>
    </div>

    <div class="p-4">
      <!-- 未设置 -->
      <SetupForm v-if="!mainStore.isSetup" @done="onSetupDone" />

      <!-- 锁定 -->
      <UnlockForm v-else-if="!mainStore.isUnlocked" @unlocked="onUnlocked" />

      <!-- 已解锁：书签收藏模式 -->
      <div v-else-if="mode === 'bookmark'" class="space-y-2">
        <!-- 页面预览 -->
        <div class="flex gap-2 items-start p-2 bg-gray-50 rounded">
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
        <p v-if="saveError" class="text-xs text-red-500 text-center">{{ saveError }}</p>
      </div>

      <!-- 已解锁：密码生成模式 -->
      <div v-else class="space-y-3">
        <input v-model="codename" placeholder="输入区分代号" class="input" @keyup.enter="generate" />
        <div class="flex gap-2">
          <select v-model="charsetMode" class="flex-1 px-2 py-2 border rounded text-sm">
            <option value="alphanumeric">字母+数字</option>
            <option value="with_symbols">含特殊字符</option>
          </select>
          <select v-model.number="pwdLength" class="w-20 px-2 py-2 border rounded text-sm">
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
        <div v-if="generatedPwd" class="p-2 bg-gray-50 rounded flex items-center justify-between">
          <code class="text-sm break-all">{{ generatedPwd }}</code>
          <button @click="copyPwd" class="ml-2 text-xs text-blue-500 hover:underline shrink-0">
            {{ copied ? '已复制' : '复制' }}
          </button>
        </div>
        <button @click="mainStore.lock()" class="w-full text-xs text-gray-400 hover:text-gray-600">锁定</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useMainStore } from '../../ui/src/stores/main';
import { useEntriesStore } from '../../ui/src/stores/entries';
import { useSyncStore } from '../../ui/src/stores/sync';
import { db, type CharsetMode } from '@flowerkey/core';
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
const saving = ref(false);
const saved = ref(false);
const saveError = ref('');

// 密码生成
const codename = ref('');
const charsetMode = ref<CharsetMode>('alphanumeric');
const pwdLength = ref(16);
const generatedPwd = ref('');
const copied = ref(false);

onMounted(async () => {
  await mainStore.checkSetup();
  if (mainStore.isUnlocked) await init();
});

async function init() {
  // 获取当前页元数据
  const data = await chrome.runtime.sendMessage({ type: 'getPageMeta' });
  meta.value = data;
  form.value.title = data.title || '';
  form.value.url = data.url || '';
  form.value.description = data.description || '';
  // 加载已有文件夹
  folders.value = await db.getAllFolders();
  // 加载 WebDAV 配置
  await syncStore.loadConfig();
}

async function onSetupDone() { await init(); }
async function onUnlocked() { await init(); }

async function saveBookmark() {
  saving.value = true; saveError.value = '';
  try {
    const tags = tagsInput.value ? tagsInput.value.split(',').map(t => t.trim()).filter(Boolean) : [];
    await entriesStore.createEntry({
      type: 'bookmark',
      title: form.value.title,
      url: form.value.url,
      favicon: meta.value.favicon,
      description: form.value.description,
      folder: form.value.folder,
      tags,
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

function openSidePanel() {
  chrome.runtime.sendMessage({ type: 'openSidePanel' });
  window.close();
}
</script>

<style scoped>
.input { @apply w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-400; }
</style>
