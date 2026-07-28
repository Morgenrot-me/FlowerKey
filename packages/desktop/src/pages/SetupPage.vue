<!--
  花钥桌面端 - 首次设置页
-->
<template>
  <div class="flex-1 flex flex-col justify-center px-8 gap-4">
    <h1 class="text-2xl font-bold text-center text-blue-600 flex items-center justify-center gap-2">
      <img src="../assets/key.png" class="w-10 h-10 object-contain" /> 花钥
    </h1>
    <p class="text-sm text-gray-500 text-center">使用记忆密码、身份密语和区分代号离线生成</p>
    <p class="text-xs text-center text-gray-400">相同输入在任意设备生成完全相同的密码</p>
    <input v-model="pwd" type="password" placeholder="记忆密码（至少4位）"
      class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400" />
    <PasswordStrength :password="pwd" />
    <input v-model="pwd2" type="password" placeholder="确认记忆密码"
      class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400" />
    <p class="text-xs text-gray-400">记忆密码决定所有生成密码的结果，输入有误将导致生成不同密码，确认输入以保证一致性。</p>
    <p class="text-xs text-orange-500 flex items-center gap-1.5"><AppIcon name="alert" :size="14" class-name="shrink-0" /> 记忆密码和身份密语共同决定全部生成密码。设置后不得修改，也不要告知他人。</p>
    <div class="rounded-xl border border-blue-200/70 bg-blue-50/70 px-4 py-3 text-xs text-blue-700">
      <p class="font-medium">极简示例</p>
      <p class="mt-1 leading-relaxed">区分代号可直接使用微信、支付宝、QQ、GitHub。英文字母不区分大小写。</p>
    </div>
    <div class="space-y-2">
      <p class="text-xs text-gray-600 font-medium">身份密语</p>
      <p class="text-xs text-gray-500 leading-relaxed">创建一条只有你知道、多年后仍能完整写出的私人身份句。它区分大小写，不要求数字、大写或符号；不要使用公开昵称、生日或其他服务的密码。</p>
      <input v-model="salt" type="password" placeholder="输入身份密语" autocomplete="new-password"
        class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400" />
      <input v-model="salt2" type="password" placeholder="完整确认身份密语" autocomplete="new-password"
        class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400" />
      <p class="text-xs text-gray-400">身份密语区分大小写、空格和标点；换设备时必须完整输入同一内容。</p>
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
import PasswordStrength from '../../../ui/src/components/PasswordStrength.vue';
import AppIcon from '../../../ui/src/icons/AppIcon.vue';
const main = useMainStore();
const pwd = ref(''), pwd2 = ref(''), salt = ref(''), salt2 = ref(''), err = ref(''), loading = ref(false);
const emit = defineEmits<{ done: [] }>();
async function submit() {
  if (pwd.value.length < 4) { err.value = '密码至少4位'; return; }
  if (pwd.value !== pwd2.value) { err.value = '两次密码不一致'; return; }
  if (!salt.value.trim()) { err.value = '请输入身份密语'; return; }
  if (salt.value !== salt.value.trim()) { err.value = '身份密语首尾不能包含空白'; return; }
  if (salt.value !== salt2.value) { err.value = '两次身份密语不一致'; return; }
  loading.value = true;
  await main.setup(pwd.value, salt.value);
  emit('done');
}
</script>
