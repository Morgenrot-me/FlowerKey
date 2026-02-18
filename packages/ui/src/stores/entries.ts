/**
 * 花钥 FlowerKey - 条目状态管理
 * 管理密码、书签、文件引用条目的 CRUD 和筛选
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { db, type Entry, type EntryType } from '@flowerkey/core';

export const useEntriesStore = defineStore('entries', () => {
  const entries = ref<Entry[]>([]);
  const currentType = ref<EntryType>('password');
  const currentFolder = ref('');
  const currentTag = ref('');
  const folders = ref<string[]>([]);
  const tags = ref<string[]>([]);

  const filteredEntries = computed(() => {
    let list = entries.value;
    if (currentFolder.value) {
      list = list.filter(e => e.folder === currentFolder.value);
    }
    if (currentTag.value) {
      list = list.filter(e => e.tags?.includes(currentTag.value));
    }
    return list;
  });

  async function loadEntries(type?: EntryType) {
    if (type) currentType.value = type;
    entries.value = await db.getEntriesByType(currentType.value);
    folders.value = await db.getAllFolders();
    tags.value = await db.getAllTags();
  }

  async function createEntry(data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>) {
    await db.createEntry(data);
    await loadEntries();
  }

  async function updateEntry(id: string, changes: Partial<Entry>) {
    await db.updateEntry(id, changes);
    await loadEntries();
  }

  async function deleteEntry(id: string) {
    await db.deleteEntry(id);
    await loadEntries();
  }

  async function search(query: string) {
    if (!query.trim()) return loadEntries();
    entries.value = await db.searchEntries(query);
  }

  return {
    entries, currentType, currentFolder, currentTag,
    folders, tags, filteredEntries,
    loadEntries, createEntry, updateEntry, deleteEntry, search,
  };
});
