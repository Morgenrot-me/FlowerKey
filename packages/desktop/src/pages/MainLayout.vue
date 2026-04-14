<!--
  花钥桌面端 - 主界面（左侧边栏导航）
-->
<template>
  <div class="flex-1 flex overflow-hidden">
    <!-- 左侧导航 -->
    <nav class="w-16 flex flex-col items-center py-4 gap-2 bg-white border-r">
      <button v-for="t in tabs" :key="t.key" @click="tab = t.key"
        :class="['w-12 h-12 flex flex-col items-center justify-center gap-0.5 rounded-xl text-xs transition-colors',
          tab === t.key ? 'bg-blue-50 text-blue-500' : 'text-gray-400 hover:bg-gray-50']">
        <AppIcon :name="t.icon" :size="22" />
        <span class="text-[10px]">{{ t.label }}</span>
      </button>
    </nav>

    <!-- 内容区 -->
    <div class="flex-1 overflow-hidden">
      <PasswordTab v-if="tab === 'password'" />
      <BookmarkTab v-else-if="tab === 'bookmark'" />
      <NoteTab v-else-if="tab === 'note'" />
      <SettingsTab v-else-if="tab === 'settings'" @lock="$emit('lock')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppIcon from '../../../ui/src/icons/AppIcon.vue';
import PasswordTab from './PasswordTab.vue';
import BookmarkTab from './BookmarkTab.vue';
import NoteTab from './NoteTab.vue';
import SettingsTab from './SettingsTab.vue';

defineEmits<{ lock: [] }>();
const tab = ref('password');
const tabs = [
  { key: 'password', icon: 'password' as const, label: '密码' },
  { key: 'bookmark', icon: 'bookmark' as const, label: '书签' },
  { key: 'note', icon: 'note' as const, label: '笔记' },
  { key: 'settings', icon: 'settings' as const, label: '设置' },
];
</script>
