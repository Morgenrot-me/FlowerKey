<!--
  花钥 SidePanel 主组件
  完整管理界面：确定性密码、加密秘密库与设置
-->
<template>
  <div class="h-screen flex bg-white dark:bg-gray-900 dark:text-gray-100">
    <div v-if="mainStore.hasUnsupportedMasterData" class="m-auto max-w-sm p-5 text-sm text-red-700 dark:text-red-300 space-y-2">
      <p class="font-medium">检测到发布前或损坏的花钥数据</p>
      <p>为避免覆盖原配置并孤立已有加密条目，花钥已停止初始化。请先清除本地开发数据，再重新打开花钥。</p>
    </div>
    <OnboardingForm v-else-if="!mainStore.isSetup && !showSetup" @done="showSetup = true" class="p-4 flex-1" />
    <SetupForm v-else-if="!mainStore.isSetup" @done="() => {}" class="p-4 flex-1" />
    <div v-else-if="!mainStore.isUnlocked" class="flex-1 flex flex-col justify-center px-4 py-5 gap-4">
      <div class="space-y-1 text-center">
        <h1 class="text-lg font-bold text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2">
          <img src="@ui/assets/key.png" class="w-6 h-6 object-contain" /> 花钥
        </h1>
        <p class="text-xs text-gray-400 dark:text-gray-500">主密码不存储，数据库密钥仅存于内存，锁定后立即清除</p>
      </div>
      <div class="rounded-3xl border border-gray-200/80 dark:border-gray-700 bg-white/90 dark:bg-gray-900/80 shadow-sm px-4 py-4 space-y-3">
        <UnlockForm @unlocked="onUnlocked" />
      </div>
    </div>

    <template v-else>
      <!-- 宽屏侧边栏导航 -->
      <nav v-if="isWide" class="flex flex-col w-16 border-r dark:border-gray-700 py-3 gap-1 shrink-0">
        <button
          v-for="tab in tabs" :key="tab.key"
          @click="changeTab(tab.key)"
          :class="['flex flex-col items-center gap-0.5 py-2 mx-1 rounded-lg text-[11px]',
            currentTab === tab.key ? 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300']"
        >
          <span class="text-lg leading-none">
            <AppIcon :name="tab.icon" :size="20" />
          </span>
          <span>{{ tab.label }}</span>
        </button>
        <button @click="requestLock" class="mt-auto mx-1 min-h-11 text-[10px] text-gray-300 hover:text-gray-500 dark:hover:text-gray-400">锁定</button>
      </nav>

      <!-- 主内容列 -->
      <div class="flex-1 flex flex-col overflow-hidden">
        <!-- 顶栏（窄屏时含导航，宽屏时只有搜索） -->
        <header class="flex items-center gap-2 px-3 py-2 border-b dark:border-gray-700 shrink-0">
          <h1 v-if="!isWide" class="text-sm font-bold"><img src="@ui/assets/key.png" class="w-4 h-4 object-contain" /></h1>
          <input v-if="currentTab === 'password'"
            v-model="searchQuery" placeholder="搜索..."
            class="flex-1 px-2 py-1 border rounded text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
            @input="onSearch"
          />
          <div v-else class="flex-1 text-xs font-medium">{{ currentTab === 'secret' ? '秘密库' : '设置' }}</div>
          <button v-if="!isWide" @click="requestLock" class="min-h-11 text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">锁定</button>
        </header>

        <!-- 窄屏顶部 Tab -->
        <nav v-if="!isWide" class="flex border-b dark:border-gray-700 shrink-0">
          <button
            v-for="tab in tabs" :key="tab.key"
            @click="changeTab(tab.key)"
            :class="['flex-1 py-2 flex flex-col items-center gap-0.5 text-[11px] transition-colors',
              currentTab === tab.key ? 'text-blue-600 border-b-2 border-blue-500 dark:text-blue-400' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-300']"
          >
            <span class="text-base leading-none">
              <AppIcon :name="tab.icon" :size="16" />
            </span>
            <span>{{ tab.label }}</span>
          </button>
        </nav>

        <Transition name="fade" mode="out-in">
          <!-- 设置页 -->
          <SettingsPage v-if="currentTab === 'settings'" key="settings" class="flex-1 overflow-y-auto" />

          <SecretPage v-else-if="currentTab === 'secret'" key="secret" class="flex-1 min-h-0" @editing-change="secretEditing = $event" />

          <!-- 内容区 -->
          <div v-else key="password" class="flex-1 flex flex-col min-h-0">
            <div class="flex-1 overflow-y-auto">
              <div v-if="entriesStore.tags.length" class="flex gap-1 px-3 py-2 text-xs flex-wrap">
                <button
                  v-for="t in entriesStore.tags" :key="t"
                  @click="toggleTag(t)"
                  :class="['px-2 py-0.5 rounded', entriesStore.selectedTags.includes(t) ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-300']"
                >{{ t }}</button>
              </div>
              <div v-if="!entriesStore.filteredEntries.length && !entriesStore.entries.length" class="px-3 pt-3">
                <div class="rounded-2xl border border-blue-200/70 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-900/20 px-4 py-3 text-xs text-blue-700 dark:text-blue-300 space-y-1.5 leading-relaxed">
                  <p class="font-medium text-blue-800 dark:text-blue-200">1 分钟上手</p>
                  <p>1. 新建一个区分代号，例如 github-main</p>
                  <p>2. 点击生成，密码会自动复制到剪贴板</p>
                  <p>3. 回到当前网站直接粘贴，常用条目会优先排在前面</p>
                </div>
              </div>
              <EntryList
                :entries="entriesStore.filteredEntries"
                @edit="editEntry"
                @delete="deleteEntry"
                @generate="generateForEntry"
              />
            </div>

            <footer class="border-t px-3 py-2 dark:border-gray-700 shrink-0">
              <div class="flex gap-2">
                <button @click="openAdd('generate')" class="flex-1 py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600">+ 生成密码</button>
                <button @click="openAdd('store')" class="flex-1 py-1.5 border border-blue-500 text-blue-500 rounded text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20">+ 存储密码</button>
              </div>
            </footer>

            <EntryForm
              v-if="showAddForm"
              :entry="editingEntry"
              :initialMode="addMode"
              :initialUrl="editingEntry ? undefined : currentTabUrl"
              :folders="entriesStore.folders"
              :tags="entriesStore.tags"
              @save="onSave"
              @cancel="closeForm"
            />
          </div>
        </Transition>
      </div>
    </template>
    <Toast :visible="toast.visible.value" :message="toast.message.value" :type="toast.type.value" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { useMainStore } from '@ui/stores/main';
import { useEntriesStore } from '@ui/stores/entries';
import { useToast } from '@ui/composables/useToast';
import { db, type Entry, type EntryType } from '@flowerkey/core';
import OnboardingForm from '@ui/components/OnboardingForm.vue';
import SetupForm from '@ui/components/SetupForm.vue';
import UnlockForm from '@ui/components/UnlockForm.vue';
import EntryList from '@ui/components/EntryList.vue';
import EntryForm from '@ui/components/EntryForm.vue';
import SettingsPage from '@ui/components/SettingsPage.vue';
import SecretPage from '@ui/components/SecretPage.vue';
import Toast from '@ui/components/Toast.vue';
import AppIcon from '@ui/icons/AppIcon.vue';
import { syncBackgroundLockState } from '../src/state-sync';

const mainStore = useMainStore();
const entriesStore = useEntriesStore();
const toast = useToast();
const showSetup = ref(false);

const searchQuery = ref('');
const showAddForm = ref(false);
const editingEntry = ref<Entry | undefined>();
const addMode = ref<'generate' | 'store' | undefined>();
const currentTabUrl = ref('');
const currentTab = ref('password');
const secretEditing = ref(false);
const isWide = ref(window.innerWidth >= 360);
const onResize = () => { isWide.value = window.innerWidth >= 360; };
onMounted(() => window.addEventListener('resize', onResize));
onUnmounted(() => window.removeEventListener('resize', onResize));

const tabs = [
  { key: 'password', icon: 'password' as const, label: '密码' },
  { key: 'secret', icon: 'note' as const, label: '秘密' },
  { key: 'settings', icon: 'settings' as const, label: '设置' },
];

onMounted(async () => {
  chrome.runtime.connect({ name: 'sidepanel' });
  await db.purgeLegacyBookmarks();
  await mainStore.checkSetup();
  if (!mainStore.isUnlocked) {
    const state = await chrome.runtime.sendMessage({ type: 'getUnlockState' });
    if (state?.isUnlocked) {
      const restored = await chrome.runtime.sendMessage({ type: 'restoreDbKey' });
      if (restored?.ok) {
        mainStore.userSalt = restored.userSalt;
        mainStore.isUnlocked = true;
      }
    }
  }
  if (mainStore.isUnlocked) await entriesStore.loadEntries();
});

async function syncBackgroundLock() {
  await syncBackgroundLockState(chrome.runtime.sendMessage, {
    isUnlocked: mainStore.isUnlocked,
    masterPwd: mainStore.masterPwd,
    userSalt: mainStore.userSalt,
  });
}

watch(() => mainStore.isUnlocked, async () => {
  await syncBackgroundLock();
});

watch(currentTab, (tab) => {
  searchQuery.value = '';
  entriesStore.selectedTags = [];
  if (tab === 'password' && mainStore.isUnlocked) entriesStore.loadEntries(tab as EntryType);
});

function changeTab(tab: string) {
  if (secretEditing.value && tab !== currentTab.value && !window.confirm('当前秘密尚未保存，确定离开吗？')) return;
  secretEditing.value = false;
  currentTab.value = tab;
}

function requestLock() {
  if (secretEditing.value && !window.confirm('当前秘密尚未保存，确定锁定吗？')) return;
  secretEditing.value = false;
  entriesStore.clear();
  mainStore.lock();
}

function onSearch() {
  entriesStore.search(searchQuery.value);
}

async function onUnlocked() {
  await syncBackgroundLock();
  if (currentTab.value === 'password') {
    await entriesStore.loadEntries(currentTab.value as EntryType);
  }
}

function toggleTag(t: string) {
  const idx = entriesStore.selectedTags.indexOf(t);
  if (idx >= 0) entriesStore.selectedTags.splice(idx, 1);
  else entriesStore.selectedTags.push(t);
}

async function openAdd(mode?: 'generate' | 'store') {
  addMode.value = mode;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  currentTabUrl.value = tab?.url ?? '';
  showAddForm.value = true;
}

function editEntry(entry: Entry) {
  editingEntry.value = entry;
  showAddForm.value = true;
}

async function deleteEntry(id: string) {
  await entriesStore.deleteEntry(id);
}

async function generateForEntry(entry: Entry) {
  const pwd = entry.storedPassword
    ? entry.storedPassword
    : entry.codename
      ? await mainStore.genPassword(entry.codename, entry.charsetMode || 'alphanumeric', entry.passwordLength || 16)
      : null;
  if (!pwd) return;
  await navigator.clipboard.writeText(pwd);
  await entriesStore.touchLastUsed(entry.id);
  toast.show('密码已复制到剪贴板', 'success');
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'fillPassword', password: pwd });
}

async function onSave(data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>) {
  if (editingEntry.value) {
    await entriesStore.updateEntry(editingEntry.value.id, data);
  } else {
    await entriesStore.createEntry(data);
  }
  closeForm();
}

function closeForm() {
  showAddForm.value = false;
  editingEntry.value = undefined;
  addMode.value = undefined;
}
</script>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
