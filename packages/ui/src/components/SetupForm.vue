<!--
  花钥 - 首次设置表单
  设置记忆密码和密码生成盐（userSalt）
-->
<template>
  <div class="space-y-3">
    <p class="text-sm text-gray-600 dark:text-gray-400 text-center font-medium">欢迎使用花钥</p>
    <p class="text-[10px] text-gray-500 dark:text-gray-400 leading-relaxed">花钥不保管你的密码，而是帮你<span class="text-gray-700 dark:text-gray-300">生成</span>密码——每次需要时，用"记忆密码 + 区分代号"即时算出，用完即弃，从不存储。只要记忆密码不变，任何设备、任何时候都能还原出相同的密码。</p>
    <p class="text-[10px] text-orange-600 dark:text-orange-400">⚠️ 记忆密码是一切的根源，请务必牢记，且绝对不可泄露给任何人——任何知道你记忆密码的人都能生成你所有网站的密码。花钥无法帮你找回它。</p>
    <input
      v-model="pwd" type="password" placeholder="记忆密码"
      class="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
    />
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
      <input
        v-model="salt" placeholder="密码生成盐（默认 FlowerKey）"
        class="w-full px-3 py-2 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100"
      />
      <p class="text-[10px] text-orange-600 dark:text-orange-400">
        ⚠️ 此盐参与所有密码的生成计算，设置后不可更改。多设备使用时必须在所有设备上填写相同的值，否则生成的密码将不一致。建议保持默认值。
      </p>
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

const emit = defineEmits<{ done: [] }>();
const mainStore = useMainStore();

const pwd = ref('');
const confirmPwd = ref('');
const salt = ref('');
const showSalt = ref(false);
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
