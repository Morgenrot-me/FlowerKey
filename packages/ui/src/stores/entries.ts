/**
 * 花钥 FlowerKey - 条目状态管理
 * 管理密码与秘密条目的 CRUD 和筛选
 */

import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { createSecretPayload, db, serializeSecretPayload, type Entry, type EntryType } from '@flowerkey/core';

function sortEntriesByRecent(entries: Entry[]) {
  return [...entries].sort((a, b) => (b.lastUsedAt ?? b.updatedAt) - (a.lastUsedAt ?? a.updatedAt));
}

export const useEntriesStore = defineStore('entries', () => {
  const entries = ref<Entry[]>([]);
  const currentType = ref<EntryType>('password');
  const selectedTags = ref<string[]>([]);
  const tags = ref<string[]>([]);
  const folders = ref<string[]>([]);

  const filteredEntries = computed(() => {
    if (!selectedTags.value.length) return entries.value;
    return entries.value.filter(e => selectedTags.value.some(t => e.tags?.includes(t)));
  });

  async function loadEntries(type?: EntryType) {
    if (type) currentType.value = type;
    if (currentType.value === 'secret') {
      const notes = await db.getEntriesByType('note');
      for (const note of notes) {
        await db.updateEntry(note.id, {
          type: 'secret',
          content: serializeSecretPayload(createSecretPayload({ title: note.title ?? '', content: note.content ?? '' })),
          title: '', description: '', tags: [], folder: '',
        });
      }
    }
    entries.value = await db.getEntriesByType(currentType.value);
    tags.value = await db.getAllTags();
    folders.value = await db.getAllFolders();
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

  async function touchLastUsed(id: string) {
    await db.touchLastUsed(id);
    await loadEntries();
  }

  async function search(query: string) {
    if (!query.trim()) return loadEntries();
    entries.value = sortEntriesByRecent(await db.searchEntries(query));
  }

  function clear() {
    entries.value = [];
    selectedTags.value = [];
    tags.value = [];
    folders.value = [];
  }

  return {
    entries, currentType, selectedTags,
    tags, folders, filteredEntries,
    loadEntries, createEntry, updateEntry, deleteEntry, touchLastUsed, search, clear,
  };
});
