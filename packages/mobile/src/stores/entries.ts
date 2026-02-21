/**
 * 花钥移动端 - 条目状态管理（SQLite 版）
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Entry, EntryType } from '@flowerkey/core';
import * as sqliteDb from '../db-sqlite';

export const useEntriesStore = defineStore('entries', () => {
  const entries = ref<Entry[]>([]);
  const currentType = ref<EntryType>('password');
  const searchQuery = ref('');

  const selectedTags = ref<string[]>([]);
  const tags = ref<string[]>([]);

  const filtered = computed(() => {
    let list = entries.value;
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      list = list.filter(e =>
        e.codename?.toLowerCase().includes(q) ||
        e.title?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q)
      );
    }
    if (selectedTags.value.length) {
      list = list.filter(e => selectedTags.value.some(t => e.tags?.includes(t)));
    }
    return list;
  });

  async function load(type: EntryType = 'password') {
    currentType.value = type;
    entries.value = await sqliteDb.getEntriesByType(type);
    tags.value = await sqliteDb.getAllTags();
  }

  async function create(data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>) {
    await sqliteDb.createEntry(data);
    await load(currentType.value);
  }

  async function update(id: string, data: Partial<Entry>) {
    await sqliteDb.updateEntry(id, data);
    await load(currentType.value);
  }

  async function remove(id: string) {
    await sqliteDb.deleteEntry(id);
    await load(currentType.value);
  }

  return { entries, filtered, currentType, searchQuery, selectedTags, tags, load, create, update, remove };
});
