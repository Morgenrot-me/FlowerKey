/**
 * 花钥移动端 - 条目状态管理（SQLite 版）
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import type { Entry, EntryType } from '@flowerkey/core';
import * as sqliteDb from '../db-sqlite';

function sortEntriesByRecent(entries: Entry[]) {
  return [...entries].sort((a, b) => (b.lastUsedAt ?? b.updatedAt) - (a.lastUsedAt ?? a.updatedAt));
}

export const useEntriesStore = defineStore('entries', () => {
  const entries = ref<Entry[]>([]);
  const currentType = ref<EntryType>('password');
  const searchQuery = ref('');

  const selectedTags = ref<string[]>([]);
  const tags = ref<string[]>([]);
  const loading = ref(false);
  const error = ref('');

  const filtered = computed(() => {
    let list = entries.value;
    if (searchQuery.value) {
      const q = searchQuery.value.toLowerCase();
      list = list.filter(e =>
        e.codename?.toLowerCase().includes(q) ||
        e.title?.toLowerCase().includes(q) ||
        e.description?.toLowerCase().includes(q)
      );
      list = sortEntriesByRecent(list);
    }
    if (selectedTags.value.length) {
      list = list.filter(e => selectedTags.value.some(t => e.tags?.includes(t)));
    }
    return list;
  });

  async function load(type: EntryType = 'password') {
    currentType.value = type;
    loading.value = true;
    error.value = '';
    try {
      entries.value = sortEntriesByRecent(await sqliteDb.getEntriesByType(type));
      tags.value = await sqliteDb.getAllTags();
    } catch { error.value = '读取条目失败，请重试'; }
    finally { loading.value = false; }
  }

  async function create(data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>) {
    loading.value = true;
    try { await sqliteDb.createEntry(data); await load(currentType.value); }
    finally { loading.value = false; }
  }

  async function update(id: string, data: Partial<Entry>) {
    loading.value = true;
    try { await sqliteDb.updateEntry(id, data); await load(currentType.value); }
    finally { loading.value = false; }
  }

  async function remove(id: string) {
    loading.value = true;
    try { await sqliteDb.deleteEntry(id); await load(currentType.value); }
    finally { loading.value = false; }
  }

  async function touchLastUsed(id: string) {
    try { await sqliteDb.updateLastUsed(id); await load(currentType.value); }
    catch { error.value = '更新使用记录失败'; }
  }

  return { entries, filtered, currentType, searchQuery, selectedTags, tags, loading, error, load, create, update, remove, touchLastUsed };
});
