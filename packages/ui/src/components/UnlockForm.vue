<!--
  花钥 - 解锁表单
  输入记忆密码验证后解锁
-->
<template>
  <div class="space-y-3">
    <p class="text-sm text-gray-600 dark:text-gray-400 text-center">请输入记忆密码</p>
    <input
      v-model="pwd" type="password" placeholder="记忆密码"
      class="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
      @keyup.enter="submit"
    />
    <p v-if="error" class="text-xs text-red-500">{{ error }}</p>
    <button
      @click="submit" :disabled="loading"
      class="w-full py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
    >
      {{ loading ? '验证中...' : '解锁' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMainStore } from '../stores/main';

const emit = defineEmits<{ unlocked: [] }>();
const mainStore = useMainStore();

const pwd = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const ok = await mainStore.unlock(pwd.value);
    if (ok) emit('unlocked');
    else error.value = '密码错误';
  } finally {
    loading.value = false;
  }
}
</script>
