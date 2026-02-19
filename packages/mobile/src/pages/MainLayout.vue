<!--
  花钥移动端 - 主界面（底部 Tab 导航）
-->
<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- 内容区 -->
    <div class="flex-1 overflow-hidden">
      <PasswordTab v-if="tab === 'password'" />
      <BookmarkTab v-else-if="tab === 'bookmark'" />
      <SettingsTab v-else-if="tab === 'settings'" @lock="$emit('lock')" />
    </div>

    <!-- 底部 Tab -->
    <nav class="flex border-t bg-white pb-safe">
      <button v-for="t in tabs" :key="t.key" @click="tab = t.key"
        :class="['flex-1 py-3 flex flex-col items-center gap-0.5 text-xs',
          tab === t.key ? 'text-blue-500' : 'text-gray-400']">
        <span class="text-xl">{{ t.icon }}</span>
        <span>{{ t.label }}</span>
      </button>
    </nav>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import PasswordTab from './PasswordTab.vue';
import BookmarkTab from './BookmarkTab.vue';
import SettingsTab from './SettingsTab.vue';

defineEmits<{ lock: [] }>();
const tab = ref('password');
const tabs = [
  { key: 'password', icon: '🔑', label: '密码' },
  { key: 'bookmark', icon: '🔖', label: '书签' },
  { key: 'settings', icon: '⚙️', label: '设置' },
];
</script>
