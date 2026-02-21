<!--
  花钥移动端 - 强制重置主密码页
  通过恢复码解锁后必须设置新主密码，不可跳过
-->
<template>
  <div class="flex-1 flex flex-col justify-center px-8 gap-4">
    <h1 class="text-xl font-bold text-center text-orange-500">设置新主密码</h1>
    <p class="text-xs text-center text-gray-500 dark:text-gray-400">你通过恢复码解锁，请立即设置新主密码。所有数据将用新密码重新加密。</p>
    <input v-model="newPwd" type="password" placeholder="新主密码"
      class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-orange-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
    <input v-model="newPwdConfirm" type="password" placeholder="确认新主密码"
      class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-orange-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
    <p v-if="err" class="text-red-500 dark:text-red-400 text-sm text-center">{{ err }}</p>
    <button @click="submit" :disabled="loading"
      class="w-full py-3 bg-orange-500 text-white rounded-xl font-medium disabled:opacity-50">
      {{ loading ? '处理中...' : '确认设置' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMainStore } from '../stores/main';

const main = useMainStore();
const newPwd = ref(''), newPwdConfirm = ref(''), err = ref(''), loading = ref(false);

async function submit() {
  if (!newPwd.value) { err.value = '请输入新主密码'; return; }
  if (newPwd.value !== newPwdConfirm.value) { err.value = '两次输入不一致'; return; }
  loading.value = true; err.value = '';
  try {
    // 恢复码场景：currentPwd 传空字符串，store 内部会跳过旧密码验证
    await main.changeMasterPwd('', newPwd.value);
  } catch (e) {
    err.value = (e as Error).message;
  } finally {
    loading.value = false;
  }
}
</script>
