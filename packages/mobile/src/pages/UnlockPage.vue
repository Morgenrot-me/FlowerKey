<!--
  花钥移动端 - 解锁页
-->
<template>
  <div class="flex-1 flex flex-col justify-center px-8 gap-4">
    <h1 class="text-2xl font-bold text-center text-blue-600">🔑 花钥</h1>
    <input v-model="pwd" type="password" placeholder="输入记忆密码"
      class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400"
      @keyup.enter="submit" />
    <p v-if="err" class="text-red-500 text-sm text-center">{{ err }}</p>
    <button @click="submit" :disabled="loading"
      class="w-full py-3 bg-blue-500 text-white rounded-xl font-medium disabled:opacity-50">
      {{ loading ? '验证中...' : '解锁' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMainStore } from '../stores/main';
const main = useMainStore();
const pwd = ref(''), err = ref(''), loading = ref(false);
defineEmits<{ unlocked: [] }>();
async function submit() {
  loading.value = true; err.value = '';
  const ok = await main.unlock(pwd.value);
  if (!ok) { err.value = '密码错误'; loading.value = false; }
}
</script>
