<!--
  花钥移动端 - 首次设置页
-->
<template>
  <div class="flex-1 flex flex-col justify-center px-8 gap-4">
    <h1 class="text-2xl font-bold text-center text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2"><img src="../assets/key.png" class="w-10 h-10 object-contain" /> 花钥</h1>
    <p class="text-sm text-gray-600 dark:text-gray-300 text-center font-medium">欢迎使用花钥</p>
    <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">花钥不保管你的密码，而是帮你<span class="text-gray-700 dark:text-gray-300 font-medium">生成</span>密码——每次需要时，用"记忆密码 + 区分代号"即时算出，用完即弃，从不存储。只要记忆密码不变，任何设备、任何时候都能还原出相同的密码。</p>
    <p class="text-xs text-orange-500 dark:text-orange-400">⚠️ 记忆密码是一切的根源，请务必牢记，且绝对不可泄露给任何人——任何知道你记忆密码的人都能生成你所有网站的密码。花钥无法帮你找回它。</p>
    <input v-model="pwd" type="password" placeholder="记忆密码（至少4位）"
      class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
    <input v-model="pwd2" type="password" placeholder="确认记忆密码"
      class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
    <p class="text-xs text-gray-400 dark:text-gray-500">记忆密码决定所有生成密码的结果，输入有误将导致生成不同密码，确认输入以保证一致性。</p>
    <button @click="showSalt = !showSalt" class="text-left text-xs text-blue-500 dark:text-blue-400">
      {{ showSalt ? '▲ 收起高级选项' : '▼ 高级选项（可选）' }}
    </button>
    <div v-if="showSalt" class="space-y-2">
      <input v-model="salt" placeholder="密码生成盐（默认 FlowerKey）"
        class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
      <p class="text-xs text-orange-500 dark:text-orange-400">⚠️ 此盐参与所有密码的生成计算，设置后不可更改。多设备使用时必须在所有设备上填写相同的值，否则生成的密码将不一致。建议保持默认值。</p>
    </div>
    <p v-if="err" class="text-red-500 dark:text-red-400 text-sm text-center">{{ err }}</p>
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
