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
    <button @click="submit" :disabled="loading"
      class="w-full py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600 disabled:opacity-50">
      {{ loading ? '验证中...' : '解锁' }}
    </button>

    <!-- 恢复码入口 -->
    <button @click="showRecovery = !showRecovery"
      class="w-full text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
      忘记密码？使用恢复码
    </button>
    <div v-if="showRecovery" class="space-y-2">
      <input v-model="recoveryCode" type="text" placeholder="粘贴恢复码"
        class="w-full px-3 py-2 border rounded text-xs font-mono focus:outline-none focus:ring-2 focus:ring-orange-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100" />
      <button @click="submitRecovery" :disabled="loading"
        class="w-full py-2 bg-orange-500 text-white rounded text-sm hover:bg-orange-600 disabled:opacity-50">
        {{ loading ? '验证中...' : '用恢复码解锁' }}
      </button>
    </div>
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
const showRecovery = ref(false);
const recoveryCode = ref('');

async function submit() {
  error.value = '';
  loading.value = true;
  try {
    const ok = await mainStore.unlock(pwd.value);
    if (ok) emit('unlocked');
    else error.value = '密码错误';
  } finally { loading.value = false; }
}

async function submitRecovery() {
  error.value = '';
  loading.value = true;
  try {
    const ok = await mainStore.recoverWithCode(recoveryCode.value.trim());
    if (ok) emit('unlocked');
    else error.value = '恢复码错误或未设置恢复码';
  } finally { loading.value = false; }
}
</script>
