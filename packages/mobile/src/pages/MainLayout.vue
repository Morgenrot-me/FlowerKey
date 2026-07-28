<!--
  花钥移动端 - 主界面（底部 Tab 导航 / 平板侧边栏）
-->
<template>
  <div class="flex-1 flex overflow-hidden">
    <!-- 平板侧边栏（md 及以上显示） -->
    <nav class="hidden md:flex flex-col w-20 border-r bg-white dark:bg-gray-900 dark:border-gray-700 py-4 gap-1 shrink-0">
      <!-- Logo -->
      <div class="mb-4 flex justify-center">
        <img src="../assets/key.png" class="w-8 h-8 object-contain opacity-90" alt="花钥" />
      </div>

      <button v-for="t in tabs" :key="t.key" @click="tab = t.key"
        :class="['flex flex-col items-center gap-1 py-3 mx-2 rounded-xl text-xs transition-colors',
          tab === t.key ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/30' : 'text-gray-400 dark:text-gray-500']">
        <AppIcon :name="t.icon" :size="24" />
        <span>{{ t.label }}</span>
      </button>

      <div class="flex-1"></div>

      <!-- 锁定 -->
      <button @click="$emit('lock')"
        class="flex flex-col items-center gap-1 py-3 mx-2 rounded-xl text-xs text-gray-400 dark:text-gray-500 transition-colors">
        <AppIcon name="lock" :size="22" />
        <span>锁定</span>
      </button>
    </nav>

    <!-- 内容区 -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- 手机顶部栏（md 以上隐藏） -->
      <header class="md:hidden flex items-center justify-between px-4 py-2 border-b bg-white dark:bg-gray-900 dark:border-gray-700">
        <div class="flex items-center gap-2">
          <img src="../assets/key.png" class="w-5 h-5 object-contain" alt="花钥" />
          <span class="text-sm font-bold text-blue-600 dark:text-blue-400">花钥</span>
        </div>
        <button @click="$emit('lock')" class="w-8 h-8 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <AppIcon name="lock" :size="18" />
        </button>
      </header>

      <div class="flex-1 overflow-hidden md:max-w-2xl md:mx-auto md:w-full">
        <PasswordTab v-if="tab === 'password'" />
        <BookmarkTab v-else-if="tab === 'bookmark'" />
        <NoteTab v-else-if="tab === 'note'" />
        <SettingsTab v-else-if="tab === 'settings'" @lock="$emit('lock')" />
      </div>

      <!-- 手机底部 Tab（md 以上隐藏） -->
      <nav class="md:hidden flex border-t bg-white dark:bg-gray-900 dark:border-gray-700 pb-safe">
        <button v-for="t in tabs" :key="t.key" @click="tab = t.key"
          :class="['flex-1 py-3 flex flex-col items-center gap-0.5 text-xs transition-colors',
            tab === t.key ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500']">
          <AppIcon :name="t.icon" :size="20" />
          <span>{{ t.label }}</span>
        </button>
      </nav>
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
