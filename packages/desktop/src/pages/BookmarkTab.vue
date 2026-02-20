<!--
  花钥移动端 - 书签 Tab
-->
<template>
  <div class="h-full flex flex-col">
    <div class="px-4 py-3 border-b flex gap-2">
      <input v-model="store.searchQuery" placeholder="搜索书签..."
        class="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-400" />
      <button @click="showForm = true" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">+ 新建</button>
    </div>

    <div class="flex-1 overflow-y-auto divide-y">
      <div v-for="e in store.filtered" :key="e.id" class="px-4 py-3 flex items-center gap-3">
        <div class="flex-1 min-w-0">
          <div class="font-medium truncate">{{ e.title || '未命名' }}</div>
          <div class="text-xs text-blue-400 truncate">{{ e.url }}</div>
        </div>
        <button @click="confirmDelete(e.id)" class="text-red-400 text-sm px-2">删除</button>
      </div>
      <div v-if="!store.filtered.length" class="p-8 text-center text-sm text-gray-400">暂无书签</div>
    </div>

    <div v-if="showForm" class="absolute inset-0 bg-white flex flex-col" style="padding-top: env(safe-area-inset-top)">
      <div class="px-4 py-3 border-b flex items-center gap-3">
        <button @click="showForm = false" class="text-blue-500">取消</button>
        <span class="flex-1 text-center font-medium">新建书签</span>
        <button @click="save" class="text-blue-500 font-medium">保存</button>
      </div>
      <div class="flex-1 px-4 py-4 flex flex-col gap-3">
        <input v-model="form.title" placeholder="标题" class="w-full px-3 py-3 border rounded-xl text-base outline-none focus:border-blue-400" />
        <input v-model="form.url" placeholder="URL" type="url" class="w-full px-3 py-3 border rounded-xl text-base outline-none focus:border-blue-400" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useEntriesStore } from '../stores/entries';

const store = useEntriesStore();
const showForm = ref(false);
const form = ref({ title: '', url: '' });

onMounted(() => store.load('bookmark'));

function confirmDelete(id: string) {
  if (confirm('确定删除此书签？')) store.remove(id);
}

async function save() {
  if (!form.value.url.trim()) return;
  await store.create({ type: 'bookmark', title: form.value.title, url: form.value.url.trim(), tags: [], folder: '', description: '' });
  form.value = { title: '', url: '' };
  showForm.value = false;
}
</script>
