<!--
  花钥移动端 - 解锁页
-->
<template>
  <div class="flex-1 flex flex-col justify-center px-8 gap-4">
    <h1 class="text-2xl font-bold text-center text-blue-600 dark:text-blue-400">🔑 花钥</h1>
    <p class="text-xs text-center text-gray-400 dark:text-gray-500">主密码不存储，数据库密钥仅存于内存，锁定后立即清除</p>
    <input v-model="pwd" type="password" placeholder="输入记忆密码"
      class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500"
      @keyup.enter="submit" />
    <p v-if="err" class="text-red-500 dark:text-red-400 text-sm text-center">{{ err }}</p>
    <button @click="submit" :disabled="loading"
      class="w-full py-3 bg-blue-500 text-white rounded-xl font-medium disabled:opacity-50">
      {{ loading ? '验证中...' : '解锁' }}
    </button>
    <button @click="showRecovery = !showRecovery" class="text-sm text-gray-400 dark:text-gray-500 text-center">
      忘记密码？使用恢复码
    </button>
    <div v-if="showRecovery" class="flex flex-col gap-2">
      <input v-model="recoveryCode" type="text" placeholder="粘贴恢复码"
        class="w-full px-4 py-3 border rounded-xl text-sm font-mono outline-none focus:border-orange-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
      <button @click="submitRecovery" :disabled="loading"
        class="w-full py-3 bg-orange-500 text-white rounded-xl font-medium disabled:opacity-50">
        {{ loading ? '验证中...' : '用恢复码解锁' }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMainStore } from '../stores/main';
const main = useMainStore();
const emit = defineEmits<{ unlocked: [] }>();
const pwd = ref(''), err = ref(''), loading = ref(false);
const showRecovery = ref(false), recoveryCode = ref('');

async function submit() {
  loading.value = true; err.value = '';
  const ok = await main.unlock(pwd.value);
  if (ok) emit('unlocked');
  else { err.value = '密码错误'; loading.value = false; }
}

async function submitRecovery() {
  loading.value = true; err.value = '';
  const ok = await main.recoverWithCode(recoveryCode.value.trim());
  if (ok) emit('unlocked');
  else { err.value = '恢复码错误或未设置恢复码'; loading.value = false; }
}
</script>
