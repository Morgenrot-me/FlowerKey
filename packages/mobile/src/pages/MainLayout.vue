<!--
  花钥移动端 - 主界面（底部 Tab 导航 / 平板侧边栏）
-->
<template>
  <div class="flex-1 flex overflow-hidden">
    <!-- 平板侧边栏（md 及以上显示） -->
    <nav class="hidden md:flex flex-col w-20 border-r bg-white dark:bg-gray-900 dark:border-gray-700 py-4 gap-1 shrink-0">
      <button v-for="t in tabs" :key="t.key" @click="tab = t.key"
        :class="['flex flex-col items-center gap-1 py-3 mx-2 rounded-xl text-xs',
          tab === t.key ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/30' : 'text-gray-400 dark:text-gray-500']">
        <span class="text-2xl">{{ t.icon }}</span>
        <span>{{ t.label }}</span>
      </button>
    </nav>

    <!-- 内容区 -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <div class="flex-1 overflow-hidden md:max-w-2xl md:mx-auto md:w-full">
        <PasswordTab v-if="tab === 'password'" />
        <BookmarkTab v-else-if="tab === 'bookmark'" />
        <NoteTab v-else-if="tab === 'note'" />
        <SettingsTab v-else-if="tab === 'settings'" @lock="$emit('lock')" />
      </div>

      <!-- 手机底部 Tab（md 以上隐藏） -->
      <nav class="md:hidden flex border-t bg-white dark:bg-gray-900 dark:border-gray-700 pb-safe">
        <button v-for="t in tabs" :key="t.key" @click="tab = t.key"
          :class="['flex-1 py-3 flex flex-col items-center gap-0.5 text-xs',
            tab === t.key ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500']">
          <span class="text-xl">{{ t.icon }}</span>
          <span>{{ t.label }}</span>
        </button>
      </nav>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PasswordTab from './PasswordTab.vue';
import BookmarkTab from './BookmarkTab.vue';
import NoteTab from './NoteTab.vue';
import SettingsTab from './SettingsTab.vue';

defineEmits<{ lock: [] }>();
const tab = ref('password');
const tabs = [
  { key: 'password', icon: '🔑', label: '密码' },
  { key: 'bookmark', icon: '🔖', label: '书签' },
  { key: 'note', icon: '📝', label: '笔记' },
  { key: 'settings', icon: '⚙️', label: '设置' },
];
</script>
