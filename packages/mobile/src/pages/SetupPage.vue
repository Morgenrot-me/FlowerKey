<template>
  <div class="flex-1 flex flex-col justify-center px-8 gap-4">
    <h1 class="text-2xl font-bold text-center text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2"><img src="../assets/key.png" class="w-10 h-10 object-contain" /> 花钥</h1>
    <p class="text-sm text-gray-600 dark:text-gray-300 text-center font-medium">欢迎使用花钥</p>
    <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">花钥不保管你的密码，而是帮你<span class="text-gray-700 dark:text-gray-300 font-medium">生成</span>密码——每次需要时，用"记忆密码 + 区分代号"即时算出，用完即弃，从不存储。只要记忆密码不变，任何设备、任何时候都能还原出相同的密码。</p>
    <p class="text-xs text-orange-500 dark:text-orange-400 flex items-center gap-1.5"><AppIcon name="alert" :size="14" class-name="shrink-0" /> 记忆密码是一切的根源，请务必牢记，且绝对不可泄露给任何人——任何知道你记忆密码的人都能生成你所有网站的密码。花钥无法帮你找回它。</p>
    <div class="rounded-xl border border-blue-200/70 bg-blue-50/70 px-4 py-3 text-xs text-blue-700 dark:border-blue-800/70 dark:bg-blue-900/20 dark:text-blue-200">
      <p class="font-medium">极简示例</p>
      <p class="mt-1 leading-relaxed">例如记忆密码只记一条你自己的短句；区分代号按网站填写 github、bilibili、招商银行。以后换设备时，只要两者保持一致，生成结果就完全一致。</p>
    </div>
    <input v-model="pwd" type="password" placeholder="记忆密码（至少4位）"
      class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
    <PasswordStrength :password="pwd" />
    <input v-model="pwd2" type="password" placeholder="确认记忆密码"
      class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
    <p class="text-xs text-gray-400 dark:text-gray-500">记忆密码决定所有生成密码的结果，输入有误将导致生成不同密码，确认输入以保证一致性。</p>
    <button @click="showSalt = !showSalt" class="text-left text-xs text-blue-500 dark:text-blue-400">
      {{ showSalt ? '▲ 收起高级选项' : '▼ 高级选项（可选）' }}
    </button>
    <div v-if="showSalt" class="space-y-2">
      <p class="text-xs text-gray-600 dark:text-gray-300 font-medium">个人标识（可选）</p>
      <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">个人标识与记忆密码共同生成你的密码，使其独一无二。即使有人知道你的记忆密码，没有你的个人标识也无法生成你的密码。推荐填写你已有的信息，如邮箱或手机号，不需要记新东西。<br/>• 同一设备设置后不再索要<br/>• 换设备时必须填写完全相同的值<br/>• 可留空，但设置后不可更改</p>
      <input v-model="salt" placeholder="邮箱或手机号（留空也可以）"
        class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
      <input v-if="salt" v-model="salt2" placeholder="确认个人标识"
        class="w-full px-4 py-3 border rounded-xl text-base outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
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
import PasswordStrength from '../../../ui/src/components/PasswordStrength.vue';
import AppIcon from '../../../ui/src/icons/AppIcon.vue';
const main = useMainStore();
const pwd = ref(''), pwd2 = ref(''), salt = ref(''), salt2 = ref(''), showSalt = ref(true), err = ref(''), loading = ref(false);
const emit = defineEmits<{ done: [] }>();
async function submit() {
  if (pwd.value.length < 4) { err.value = '密码至少4位'; return; }
  if (pwd.value !== pwd2.value) { err.value = '两次密码不一致'; return; }
  if (salt.value && salt.value !== salt2.value) { err.value = '两次记忆标识不一致'; return; }
  loading.value = true;
  await main.setup(pwd.value, salt.value || undefined);
  emit('done');
}
</script>

