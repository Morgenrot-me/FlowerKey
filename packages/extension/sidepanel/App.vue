<!--
  花钥 SidePanel 主组件
  完整管理界面：密码/书签/文件引用的增删改查
-->
<template>
  <div class="h-screen flex flex-col bg-white dark:bg-gray-900 dark:text-gray-100">
    <SetupForm v-if="!mainStore.isSetup" @done="() => {}" class="p-4" />
    <UnlockForm v-else-if="!mainStore.isUnlocked && (currentTab !== 'bookmark' || bookmarkEncrypt)" @unlocked="() => {}" class="p-4" />

    <template v-else>
      <!-- 顶栏 -->
      <header class="flex items-center gap-2 px-3 py-2 border-b dark:border-gray-700">
        <h1 class="text-sm font-bold">🔑 花钥</h1>
        <input
          v-model="searchQuery" placeholder="搜索..."
          class="flex-1 px-2 py-1 border rounded text-xs dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
          @input="onSearch"
        />
        <button @click="mainStore.lock()" class="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">锁定</button>
      </header>

      <!-- 导航标签 -->
      <nav class="flex border-b text-xs dark:border-gray-700">
        <button
          v-for="tab in tabs" :key="tab.key"
          @click="currentTab = tab.key"
          :class="['flex-1 py-2', currentTab === tab.key ? 'border-b-2 border-blue-500 text-blue-600' : 'text-gray-500 dark:text-gray-400']"
        >{{ tab.label }}</button>
      </nav>

      <!-- 设置页 -->
      <SettingsPage v-if="currentTab === 'settings'" class="flex-1 overflow-y-auto" />

      <!-- 内容区 -->
      <template v-if="currentTab !== 'settings'">
      <div class="flex-1 overflow-y-auto">
        <!-- 筛选栏 -->
        <div class="flex gap-1 px-3 py-2 text-xs flex-wrap">
          <button
            v-for="f in entriesStore.folders" :key="f"
            @click="entriesStore.currentFolder = entriesStore.currentFolder === f ? '' : f"
            :class="['px-2 py-0.5 rounded', entriesStore.currentFolder === f ? 'bg-blue-100 text-blue-600 dark:bg-blue-900 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 dark:text-gray-300']"
          >{{ f || '未分类' }}</button>
        </div>

        <!-- 条目列表 -->
        <EntryList
          :entries="entriesStore.filteredEntries"
          @edit="editEntry"
          @delete="deleteEntry"
          @generate="generateForEntry"
        />
      </div>

      <!-- 底部操作栏 -->
      <footer class="border-t px-3 py-2 dark:border-gray-700">
        <div v-if="currentTab === 'password'" class="flex gap-2">
          <button @click="openAdd('generate')" class="flex-1 py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600">+ 生成密码</button>
          <button @click="openAdd('store')" class="flex-1 py-1.5 border border-blue-500 text-blue-500 rounded text-xs hover:bg-blue-50 dark:hover:bg-blue-900/20">+ 存储密码</button>
        </div>
        <button v-else @click="openAdd()" class="w-full py-1.5 bg-blue-500 text-white rounded text-xs hover:bg-blue-600">+ 新建</button>
      </footer>

      <!-- 新建/编辑弹窗 -->
      <EntryForm
        v-if="showAddForm"
        :entry="editingEntry"
        :type="entriesStore.currentType"
        :initialMode="addMode"
        @save="onSave"
        @cancel="closeForm"
      />
      </template>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useMainStore } from '../../ui/src/stores/main';
import { useEntriesStore } from '../../ui/src/stores/entries';
import { db, deriveDatabaseKey, type Entry, type EntryType } from '@flowerkey/core';
import SetupForm from '../../ui/src/components/SetupForm.vue';
import UnlockForm from '../../ui/src/components/UnlockForm.vue';
import EntryList from '../../ui/src/components/EntryList.vue';
import EntryForm from '../../ui/src/components/EntryForm.vue';
import SettingsPage from '../../ui/src/components/SettingsPage.vue';

const mainStore = useMainStore();
const entriesStore = useEntriesStore();

const searchQuery = ref('');
const showAddForm = ref(false);
const editingEntry = ref<Entry | undefined>();
const addMode = ref<'generate' | 'store' | undefined>();
const currentTab = ref('password');
const bookmarkEncrypt = ref(true);

const tabs = [
  { key: 'password', label: '密码' },
  { key: 'bookmark', label: '书签' },
  { key: 'file_ref', label: '文件' },
  { key: 'settings', label: '设置' },
];

function syncSession() {
  chrome.runtime.sendMessage({
    type: 'setSession',
    isUnlocked: mainStore.isUnlocked,
    masterPwd: mainStore.masterPwd,
    userSalt: mainStore.userSalt,
  });
}

onMounted(async () => {
  await mainStore.checkSetup();
  bookmarkEncrypt.value = (await db.getConfig<boolean>('bookmarkEncrypt')) ?? true;
  if (!mainStore.isUnlocked) {
    const session = await chrome.storage.session.get(['isUnlocked', 'masterPwd', 'userSalt']);
    if (session.isUnlocked && session.masterPwd) {
      mainStore.masterPwd = session.masterPwd;
      mainStore.userSalt = session.userSalt;
      mainStore.isUnlocked = true;
      db.setDbKey(await deriveDatabaseKey(session.masterPwd, session.userSalt));
    }
  }
  if (mainStore.isUnlocked) await entriesStore.loadEntries();
  else if (!bookmarkEncrypt.value) await entriesStore.loadEntries('bookmark');
});

watch(() => mainStore.isUnlocked, (unlocked) => {
  syncSession();
  if (unlocked) entriesStore.loadEntries();
});

watch(currentTab, (tab) => {
  if (tab !== 'settings' && (mainStore.isUnlocked || (tab === 'bookmark' && !bookmarkEncrypt.value))) {
    entriesStore.loadEntries(tab as EntryType);
  }
});

function onSearch() {
  entriesStore.search(searchQuery.value);
}

function openAdd(mode?: 'generate' | 'store') {
  addMode.value = mode;
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
  if (!entry.codename) return;
  const pwd = await mainStore.genPassword(
    entry.codename, entry.charsetMode || 'alphanumeric', entry.passwordLength || 16
  );
  await navigator.clipboard.writeText(pwd);
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
