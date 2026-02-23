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
  const selectedTags = ref<string[]>([]);

  const tags = computed(() => {
    const set = new Set<string>();
    entries.value.forEach(e => e.tags?.forEach(t => set.add(t)));
    return [...set];
  });

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
      list = list.filter(e => selectedTags.value.every(t => e.tags?.includes(t)));
    }
    return list;
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

  return { entries, filtered, tags, selectedTags, currentType, searchQuery, load, create, update, remove };
});
