<!--
  花钥 - 首次设置表单
  设置记忆密码和自定义盐
-->
<template>
  <div class="space-y-3">
    <p class="text-sm text-gray-600 dark:text-gray-400 text-center">首次使用，请设置记忆密码</p>
    <p class="text-[10px] text-center text-gray-400 dark:text-gray-500">密码永不上传，所有数据仅存于本设备，无任何遥测</p>
    <input
      v-model="pwd" type="password" placeholder="记忆密码"
      class="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
    />
    <input
      v-model="confirmPwd" type="password" placeholder="确认密码"
      class="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
    />
    <p class="text-[10px] text-gray-400 dark:text-gray-500">记忆密码决定所有生成密码的结果，输入有误将导致生成不同密码，确认输入以保证一致性。</p>
    <input
      v-model="salt" placeholder="自定义盐（可选，留空自动生成）"
      class="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
    />
    <p v-if="error" class="text-xs text-red-500">{{ error }}</p>
    <button
      @click="submit" :disabled="loading"
      class="w-full py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50"
    >
      {{ loading ? '设置中...' : '确认设置' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMainStore } from '../stores/main';

const emit = defineEmits<{ done: [] }>();
const mainStore = useMainStore();

const pwd = ref('');
const confirmPwd = ref('');
const salt = ref('');
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  if (pwd.value.length < 4) { error.value = '密码至少4位'; return; }
  if (pwd.value !== confirmPwd.value) { error.value = '两次密码不一致'; return; }
  loading.value = true;
  try {
    await mainStore.setup(pwd.value, salt.value || undefined);
    emit('done');
  } finally {
    loading.value = false;
  }
}
</script>
