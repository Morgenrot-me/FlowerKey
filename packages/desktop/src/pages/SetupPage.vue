<!--
  花钥移动端 - 首次设置页
-->
<template>
  <div class="flex-1 flex flex-col justify-center px-8 gap-4">
    <h1 class="text-2xl font-bold text-center text-blue-600 flex items-center justify-center gap-2">
      <img src="../assets/key.png" class="w-10 h-10 object-contain" /> 花钥
    </h1>
    <p class="text-sm text-gray-500 text-center">密码不存储，只生成</p>
    <p class="text-xs text-center text-gray-400">密码永不上传，所有数据仅存于本设备，无任何遥测</p>
    <input v-model="pwd" type="password" placeholder="记忆密码（至少4位）"
      class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400" />
    <input v-model="pwd2" type="password" placeholder="确认记忆密码"
      class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400" />
    <p class="text-xs text-gray-400">记忆密码决定所有生成密码的结果，输入有误将导致生成不同密码，确认输入以保证一致性。</p>
    <button @click="showSalt = !showSalt" class="text-left text-xs text-blue-500">
      {{ showSalt ? '▲ 收起高级选项' : '▼ 高级选项（可选）' }}
    </button>
    <div v-if="showSalt" class="space-y-2">
      <input v-model="salt" placeholder="邮箱 / 手机号 / 任意可记忆标识"
        class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400" />
      <p class="text-xs text-orange-500">⚠️ 任何你能稳定记住的字符串均可，如 you@example.com、13800138000、myusername。它与记忆密码共同参与密码生成，使你的密码独一无二。设置后不可更改，多设备使用时必须填写完全相同的值。</p>
    </div>
    <p v-if="err" class="text-red-500 text-sm text-center">{{ err }}</p>
    <button @click="submit" :disabled="loading"
      class="w-full py-3 bg-blue-500 text-white rounded-xl font-medium disabled:opacity-50">
      {{ loading ? '设置中...' : '开始使用' }}
    </button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMainStore } from '../stores/main';
const main = useMainStore();
const pwd = ref(''), pwd2 = ref(''), salt = ref(''), showSalt = ref(false), err = ref(''), loading = ref(false);
const emit = defineEmits<{ done: [] }>();
async function submit() {
  if (pwd.value.length < 4) { err.value = '密码至少4位'; return; }
  if (pwd.value !== pwd2.value) { err.value = '两次密码不一致'; return; }
  loading.value = true;
  await main.setup(pwd.value, salt.value || undefined);
  emit('done');
}
</script>
