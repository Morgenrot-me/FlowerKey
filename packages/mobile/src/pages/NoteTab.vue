<!--
  花钥移动端 - 笔记 Tab
  端到端加密的私密笔记
-->
<template>
  <div class="h-full flex flex-col">
    <div class="px-4 py-3 border-b flex gap-2">
      <input v-model="searchQuery" placeholder="搜索笔记..."
        class="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-400" />
      <button @click="openNew" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">+ 新建</button>
    </div>

    <div class="flex-1 overflow-y-auto divide-y">
      <div v-for="e in filtered" :key="e.id" @click="openEdit(e)"
        class="px-4 py-3 active:bg-gray-50">
        <div class="font-medium truncate text-sm">{{ e.title || '无标题' }}</div>
        <div class="text-xs text-gray-400 truncate mt-0.5">{{ e.content?.slice(0, 80) || '' }}</div>
        <div class="text-[10px] text-gray-300 mt-1">{{ new Date(e.updatedAt).toLocaleDateString() }}</div>
      </div>
      <div v-if="!filtered.length" class="p-8 text-center text-sm text-gray-400">暂无笔记，点击右上角新建</div>
    </div>

    <!-- 新建/编辑表单 -->
    <div v-if="showForm" class="absolute inset-0 bg-white flex flex-col" style="padding-top: env(safe-area-inset-top)">
      <div class="px-4 py-3 border-b flex items-center gap-3">
        <button @click="showForm = false" class="text-blue-500">取消</button>
        <span class="flex-1 text-center font-medium">{{ editingId ? '编辑笔记' : '新建笔记' }}</span>
        <button @click="save" :disabled="!form.content.trim()" class="text-blue-500 font-medium disabled:opacity-40">保存</button>
      </div>
      <div class="flex-1 px-4 py-4 flex flex-col gap-3 overflow-y-auto">
        <input v-model="form.title" placeholder="标题（可选）"
          class="w-full px-3 py-3 border rounded-xl text-base outline-none focus:border-blue-400" />
        <textarea v-model="form.content" placeholder="笔记内容（端到端加密）"
          class="flex-1 w-full px-3 py-3 border rounded-xl text-base outline-none focus:border-blue-400 resize-none min-h-[200px]" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useEntriesStore } from '../stores/entries';
import type { Entry } from '@flowerkey/core';

const store = useEntriesStore();
const searchQuery = ref('');
const showForm = ref(false);
const editingId = ref('');
const form = ref({ title: '', content: '' });

onMounted(() => store.load('note'));

const filtered = computed(() => {
  const q = searchQuery.value.toLowerCase();
  if (!q) return store.entries;
  return store.entries.filter(e =>
    e.title?.toLowerCase().includes(q) || e.content?.toLowerCase().includes(q)
  );
});

function openNew() {
  editingId.value = '';
  form.value = { title: '', content: '' };
  showForm.value = true;
}

function openEdit(e: Entry) {
  editingId.value = e.id;
  form.value = { title: e.title || '', content: e.content || '' };
  showForm.value = true;
}

async function save() {
  if (!form.value.content.trim()) return;
  if (editingId.value) {
    await store.update(editingId.value, { title: form.value.title, content: form.value.content });
  } else {
    await store.create({ type: 'note', title: form.value.title, content: form.value.content, tags: [], folder: '', description: '' });
  }
  showForm.value = false;
}
</script>
