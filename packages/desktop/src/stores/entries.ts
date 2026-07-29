/**
 * 花钥桌面端 - 条目状态管理
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
      list = sortEntriesByRecent(list);
    }
    if (selectedTags.value.length) {
      list = list.filter(e => selectedTags.value.some(t => e.tags?.includes(t)));
    }
    return list;
  });

  async function load(type: EntryType = 'password') {
    currentType.value = type;
    if (type === 'secret') {
      const notes = await db.getEntriesByType('note');
      for (const note of notes) {
        await db.updateEntry(note.id, {
          type: 'secret',
          content: serializeSecretPayload(createSecretPayload({ title: note.title ?? '', content: note.content ?? '' })),
          title: '', description: '', tags: [], folder: '',
        });
      }
    }
    entries.value = await db.getEntriesByType(type);
    tags.value = await db.getAllTags();
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

  async function touchLastUsed(id: string) {
    await db.touchLastUsed(id);
    await load(currentType.value);
  }

  function clear() {
    entries.value = [];
    tags.value = [];
    selectedTags.value = [];
    searchQuery.value = '';
  }

  return { entries, filtered, tags, selectedTags, currentType, searchQuery, load, create, update, remove, touchLastUsed, clear };
});
