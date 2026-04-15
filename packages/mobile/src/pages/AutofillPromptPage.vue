<!--
  花钥移动端 - 自动填充引导页
  首次设置完成后（仅 Android）引导用户启用系统自动填充服务
-->
<template>
  <div class="h-full flex flex-col items-center justify-between px-6 py-12">
    <div class="flex-1 flex flex-col items-center justify-center gap-8 w-full max-w-sm">
      <div class="w-16 h-16 rounded-2xl bg-blue-50 dark:bg-blue-900/20 text-blue-500 dark:text-blue-400 flex items-center justify-center">
        <AppIcon name="lock" :size="34" />
      </div>
      <div class="flex flex-col items-center gap-3 text-center">
        <p class="text-xl font-bold dark:text-gray-100">启用自动填充</p>
        <p class="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">
          在任何 App 或浏览器的密码框，花钥可自动识别并填充——无需手动复制粘贴。
        </p>
      </div>
      <div class="w-full flex flex-col gap-3">
        <button @click="open" class="w-full py-3.5 bg-blue-500 text-white rounded-2xl text-base font-medium">
          立即开启
        </button>
        <button @click="$emit('done')" class="w-full py-3 text-gray-400 dark:text-gray-500 text-sm">
          跳过
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { registerPlugin } from '@capacitor/core';
import AppIcon from '../../../ui/src/icons/AppIcon.vue';

const AutofillState = registerPlugin<{
  openSettings(): Promise<void>;
}>('AutofillState');

const emit = defineEmits<{ done: [] }>();

async function open() {
  await AutofillState.openSettings().catch(() => {});
  emit('done');
}
</script>

