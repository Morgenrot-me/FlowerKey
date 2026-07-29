<!--
  花钥 - 条目列表组件
  展示密码条目
-->
<template>
  <div class="divide-y dark:divide-gray-700">
    <div
      v-for="entry in entries" :key="entry.id"
      class="px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-800 flex items-center gap-2 text-xs"
    >
      <img v-if="entry.favicon" :src="entry.favicon" class="w-4 h-4 shrink-0 rounded-sm" @error="(e) => (e.target as HTMLImageElement).style.display='none'" />
      <div class="flex-1 min-w-0">
        <div class="font-medium truncate">
          {{ entry.codename || entry.title || entry.fileName || '未命名' }}
        </div>
        <div v-if="entry.type === 'password'" class="text-gray-500 dark:text-gray-400 truncate">
          {{ buildPasswordMeta(entry) }}
        </div>
        <div v-if="entry.type === 'password' && entry.description" class="text-gray-400 truncate mt-0.5">
          {{ entry.description }}
        </div>
        <div v-if="entry.tags?.length" class="flex gap-1 mt-0.5">
          <span
            v-for="t in entry.tags"
            :key="t"
            :class="t === '临时'
              ? 'px-1 border border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/70 dark:bg-blue-900/20 dark:text-blue-300 rounded text-[10px]'
              : 'px-1 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded text-[10px]'"
          >{{ t }}</span>
        </div>
      </div>
      <div class="flex gap-1 shrink-0">
        <button v-if="entry.type === 'password'" @click="onAction(entry)" :class="['px-1.5 py-0.5 rounded', copiedId === entry.id ? 'bg-green-50 text-green-600 dark:bg-green-900 dark:text-green-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900 dark:text-blue-300']">{{ copiedId === entry.id ? '已复制' : (entry.storedPassword ? '复制' : '生成') }}</button>
        <button @click="$emit('edit', entry)" class="px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 dark:text-gray-300 rounded hover:bg-gray-200">编辑</button>
        <button @click="handleDelete(entry.id)" class="px-1.5 py-0.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900 rounded">删除</button>
      </div>
    </div>
    <div v-if="!entries.length" class="p-6 text-center text-xs text-gray-400">暂无条目，点击下方按钮新建</div>
    <ConfirmDialog :visible="confirmVisible" :title="confirmOpts.title" :message="confirmOpts.message"
      :danger="confirmOpts.danger" @confirm="onConfirm" @cancel="onCancel" />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import type { Entry } from '@flowerkey/core';
import { useConfirm } from '../composables/useConfirm';
import ConfirmDialog from './ConfirmDialog.vue';
defineProps<{ entries: Entry[] }>();
const emit = defineEmits<{ edit: [Entry]; delete: [string]; generate: [Entry] }>();

const copiedId = ref('');
const { visible: confirmVisible, options: confirmOpts, ask, onConfirm, onCancel } = useConfirm();

function fmtDate(ts?: number) {
  if (!ts) return '未使用';
  return new Date(ts).toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' });
}

function buildPasswordMeta(entry: Entry) {
  const mode = entry.storedPassword ? '已存储' : (entry.charsetMode === 'with_symbols' ? '含特殊字符' : '字母+数字');
  const length = entry.storedPassword ? '自定义密码' : `${entry.passwordLength || 16}位`;
  return `${length} · ${mode} · 最近使用 ${fmtDate(entry.lastUsedAt)}`;
}

async function handleDelete(id: string) {
  if (await ask('确定删除此条目？', { title: '删除确认', danger: true })) {
    emit('delete', id);
  }
}

function onAction(entry: Entry) {
  emit('generate', entry);
  copiedId.value = entry.id;
  setTimeout(() => { copiedId.value = ''; }, 1500);
}
</script>
