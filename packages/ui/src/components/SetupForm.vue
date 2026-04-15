<!--
  花钥 - 首次设置表单
  设置记忆密码和密码生成盐（userSalt）
-->
<template>
  <div class="space-y-3">
    <p class="text-sm text-gray-600 dark:text-gray-400 text-center font-medium">欢迎使用花钥</p>
    <p class="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">花钥不保管你的密码，而是帮你<span class="text-gray-700 dark:text-gray-300">生成</span>密码——每次需要时，用"记忆密码 + 区分代号"即时算出，用完即弃，从不存储。只要记忆密码不变，任何设备、任何时候都能还原出相同的密码。如需存储固定密码，也可手动选择加密保存。</p>
    <p class="text-[10px] text-orange-600 dark:text-orange-400 flex items-center gap-1.5"><AppIcon name="alert" :size="12" class-name="shrink-0" /> 记忆密码是一切的根源，请务必牢记，且绝对不可泄露给任何人——任何知道你记忆密码的人都能生成你所有网站的密码。花钥无法帮你找回它。</p>
    <input
      v-model="pwd" type="password" placeholder="记忆密码"
      class="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
    />
    <PasswordStrength :password="pwd" />
    <input
      v-model="confirmPwd" type="password" placeholder="确认密码"
      class="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
    />
    <p class="text-[10px] text-gray-400 dark:text-gray-500">记忆密码决定所有生成密码的结果，输入有误将导致生成不同密码，确认输入以保证一致性。</p>

    <!-- 高级选项：密码生成盐 -->
    <button @click="showSalt = !showSalt" class="w-full text-left text-[10px] text-blue-500 hover:underline">
      {{ showSalt ? '▲ 收起高级选项' : '▼ 高级选项（可选）' }}
    </button>
    <div v-if="showSalt" class="space-y-1.5">
      <p class="text-[10px] text-gray-600 dark:text-gray-300 font-medium">个人标识（可选）</p>
      <p class="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">个人标识与记忆密码共同生成你的密码，使其独一无二。即使有人知道你的记忆密码，没有你的个人标识也无法生成你的密码。推荐填写你已有的信息，如邮箱或手机号，不需要记新东西。<br/>• 同一设备设置后不再索要<br/>• 换设备时必须填写完全相同的值<br/>• 可留空，但设置后不可更改</p>
      <input
        v-model="salt" placeholder="邮箱或手机号（留空也可以）"
        class="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
      />
      <input v-if="salt"
        v-model="salt2" placeholder="确认个人标识"
        class="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
      />
    </div>

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
import PasswordStrength from './PasswordStrength.vue';
import AppIcon from '../icons/AppIcon.vue';

const emit = defineEmits<{ done: [] }>();
const mainStore = useMainStore();

const pwd = ref('');
const confirmPwd = ref('');
const salt = ref('');
const salt2 = ref('');
const showSalt = ref(true);
const error = ref('');
const loading = ref(false);

async function submit() {
  error.value = '';
  if (pwd.value.length < 4) { error.value = '密码至少4位'; return; }
  if (pwd.value !== confirmPwd.value) { error.value = '两次密码不一致'; return; }
  if (salt.value && salt.value !== salt2.value) { error.value = '两次记忆标识不一致'; return; }
  loading.value = true;
  try {
    await mainStore.setup(pwd.value, salt.value || undefined);
    emit('done');
  } finally {
    loading.value = false;
  }
}
</script>
