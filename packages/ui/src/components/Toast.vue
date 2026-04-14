<!--
  花钥 - Toast 提示组件
  轻量级操作反馈，自动消失
  通过 useToast() composable 使用
-->
<template>
  <Teleport to="body">
    <Transition name="toast">
      <div v-if="visible"
        :class="['fixed left-1/2 -translate-x-1/2 z-[200] px-4 py-2 rounded-xl shadow-lg text-sm font-medium whitespace-nowrap',
          type === 'success' ? 'bg-green-500 text-white' :
          type === 'error' ? 'bg-red-500 text-white' :
          'bg-gray-800 dark:bg-gray-200 text-white dark:text-gray-800']"
        :style="{ bottom: '80px' }">
        {{ message }}
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
defineProps<{
  visible: boolean;
  message: string;
  type?: 'success' | 'error' | 'info';
}>();
</script>

<style>
.toast-enter-active { transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1); }
.toast-leave-active { transition: all 0.2s ease-in; }
.toast-enter-from { opacity: 0; transform: translate(-50%, 20px); }
.toast-leave-to { opacity: 0; transform: translate(-50%, -10px); }
</style>
