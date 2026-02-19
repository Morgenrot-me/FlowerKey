<!--
  花钥 - 条目列表组件
  展示密码/书签/文件引用条目
-->
<template>
  <div class="divide-y">
    <div
      v-for="entry in entries" :key="entry.id"
      class="px-3 py-2 hover:bg-gray-50 flex items-center gap-2 text-xs"
    >
      <div class="flex-1 min-w-0">
        <div class="font-medium truncate">
          {{ entry.codename || entry.title || entry.fileName || '未命名' }}
        </div>
        <div class="text-gray-400 truncate">
          {{ entry.description || entry.url || entry.sourceUrl || '' }}
        </div>
        <div v-if="entry.tags?.length" class="flex gap-1 mt-0.5">
          <span v-for="t in entry.tags" :key="t" class="px-1 bg-gray-100 rounded text-[10px]">{{ t }}</span>
        </div>
      </div>
      <div class="flex gap-1 shrink-0">
        <button v-if="entry.type === 'password'" @click="onGenerate(entry)" :class="['px-1.5 py-0.5 rounded', copiedId === entry.id ? 'bg-green-50 text-green-600' : 'bg-blue-50 text-blue-600 hover:bg-blue-100']">{{ copiedId === entry.id ? '已复制' : '生成' }}</button>
        <button @click="$emit('edit', entry)" class="px-1.5 py-0.5 bg-gray-100 rounded hover:bg-gray-200">编辑</button>
        <button @click="$emit('delete', entry.id)" class="px-1.5 py-0.5 text-red-500 hover:bg-red-50 rounded">删除</button>
      </div>
    </div>
    <div v-if="!entries.length" class="p-6 text-center text-xs text-gray-400">暂无数据</div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Entry } from '@flowerkey/core';
defineProps<{ entries: Entry[] }>();
const emit = defineEmits<{ edit: [Entry]; delete: [string]; generate: [Entry] }>();

const copiedId = ref('');
function onGenerate(entry: Entry) {
  emit('generate', entry);
  copiedId.value = entry.id;
  setTimeout(() => { copiedId.value = ''; }, 1500);
}
</script>
