/**
 * 花钥移动端 - 条目状态管理
 */
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { db, type Entry, type EntryType } from '@flowerkey/core';

export const useEntriesStore = defineStore('entries', () => {
  const entries = ref<Entry[]>([]);
  const currentType = ref<EntryType>('password');
  const searchQuery = ref('');

  const filtered = computed(() => {
    if (!searchQuery.value) return entries.value;
    const q = searchQuery.value.toLowerCase();
    return entries.value.filter(e =>
      e.codename?.toLowerCase().includes(q) ||
      e.title?.toLowerCase().includes(q) ||
      e.description?.toLowerCase().includes(q)
    );
  });

  async function load(type: EntryType = 'password') {
    currentType.value = type;
    entries.value = await db.getEntriesByType(type);
  }

  async function create(data: Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>) {
    await db.createEntry(data);
    await load(currentType.value);
  }

  async function update(id: string, data: Partial<Entry>) {
    await db.updateEntry(id, data);
    await load(currentType.value);
  }

  async function remove(id: string) {
    await db.deleteEntry(id);
    await load(currentType.value);
  }

  return { entries, filtered, currentType, searchQuery, load, create, update, remove };
});
