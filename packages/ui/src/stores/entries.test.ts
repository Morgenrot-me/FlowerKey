/**
 * 花钥 FlowerKey - 条目 Store 测试
 * 覆盖条目加载、筛选、搜索和 CRUD 刷新行为。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPinia, setActivePinia } from 'pinia';
import type { Entry } from '@flowerkey/core';

const dbMock = vi.hoisted(() => ({
  getEntriesByType: vi.fn(),
  getAllTags: vi.fn(),
  getAllFolders: vi.fn(),
  createEntry: vi.fn(),
  updateEntry: vi.fn(),
  deleteEntry: vi.fn(),
  touchLastUsed: vi.fn(),
  searchEntries: vi.fn(),
}));

vi.mock('@flowerkey/core', () => ({
  db: dbMock,
}));

const entry = (id: string, tags: string[], updatedAt: number, lastUsedAt?: number): Entry => ({
  id,
  type: 'password',
  tags,
  folder: '',
  description: '',
  codename: id,
  createdAt: updatedAt,
  updatedAt,
  lastUsedAt,
});

describe('useEntriesStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
    dbMock.getEntriesByType.mockResolvedValue([]);
    dbMock.getAllTags.mockResolvedValue([]);
    dbMock.getAllFolders.mockResolvedValue([]);
    dbMock.createEntry.mockResolvedValue(undefined);
    dbMock.updateEntry.mockResolvedValue(undefined);
    dbMock.deleteEntry.mockResolvedValue(undefined);
    dbMock.touchLastUsed.mockResolvedValue(undefined);
    dbMock.searchEntries.mockResolvedValue([]);
  });

  it('loads entries for the selected type and refreshes tags and folders', async () => {
    const { useEntriesStore } = await import('./entries.js');
    const store = useEntriesStore();
    const loaded = [entry('one', ['work'], 1000)];
    dbMock.getEntriesByType.mockResolvedValueOnce(loaded);
    dbMock.getAllTags.mockResolvedValueOnce(['work']);
    dbMock.getAllFolders.mockResolvedValueOnce(['工作']);

    await store.loadEntries('bookmark');

    expect(store.currentType).toBe('bookmark');
    expect(store.entries).toEqual(loaded);
    expect(store.tags).toEqual(['work']);
    expect(store.folders).toEqual(['工作']);
    expect(dbMock.getEntriesByType).toHaveBeenCalledWith('bookmark');
  });

  it('filters entries when selected tags are set', async () => {
    const { useEntriesStore } = await import('./entries.js');
    const store = useEntriesStore();
    store.entries = [entry('one', ['work'], 1000), entry('two', ['personal'], 2000)];
    store.selectedTags = ['work'];

    expect(store.filteredEntries.map(item => item.id)).toEqual(['one']);
  });

  it('refreshes the current list after create, update, delete and touch operations', async () => {
    const { useEntriesStore } = await import('./entries.js');
    const store = useEntriesStore();
    dbMock.getEntriesByType.mockResolvedValue([entry('one', [], 1000)]);
    dbMock.getAllTags.mockResolvedValue(['tag']);
    dbMock.getAllFolders.mockResolvedValue(['工作']);

    await store.createEntry({ type: 'password', tags: [], folder: '', description: '', codename: 'one' });
    await store.updateEntry('one', { description: 'updated' });
    await store.deleteEntry('one');
    await store.touchLastUsed('one');

    expect(dbMock.createEntry).toHaveBeenCalledOnce();
    expect(dbMock.updateEntry).toHaveBeenCalledWith('one', { description: 'updated' });
    expect(dbMock.deleteEntry).toHaveBeenCalledWith('one');
    expect(dbMock.touchLastUsed).toHaveBeenCalledWith('one');
    expect(dbMock.getEntriesByType).toHaveBeenCalledTimes(4);
  });

  it('loads current entries for blank search and sorts non-empty search results by recent use', async () => {
    const { useEntriesStore } = await import('./entries.js');
    const store = useEntriesStore();
    const older = entry('older', [], 1000);
    const newer = entry('newer', [], 1000, 3000);
    dbMock.searchEntries.mockResolvedValueOnce([older, newer]);

    await store.search('   ');
    expect(dbMock.getEntriesByType).toHaveBeenCalledWith('password');

    await store.search('git');
    expect(dbMock.searchEntries).toHaveBeenCalledWith('git');
    expect(store.entries.map(item => item.id)).toEqual(['newer', 'older']);
  });
});
