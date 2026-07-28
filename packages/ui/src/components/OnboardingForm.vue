<!--
  花钥 - 引导表单（插件端紧凑版）
-->
<template>
  <div class="flex flex-col items-center gap-4 py-4">
    <p class="text-sm text-gray-600 dark:text-gray-400 text-center font-medium">欢迎使用花钥</p>
    <div class="flex flex-col gap-3 w-full text-xs">
      <div class="flex gap-2 items-start">
        <AppIcon name="brain" :size="18" class="shrink-0 mt-0.5 text-blue-500" />
        <p class="text-gray-500 dark:text-gray-400 leading-relaxed">记忆密码 + 身份密语 + 区分代号，任何设备都能还原出相同的强密码。</p>
      </div>
      <div class="flex gap-2 items-start">
        <AppIcon name="shield" :size="18" class="shrink-0 mt-0.5 text-green-500" />
        <p class="text-gray-500 dark:text-gray-400 leading-relaxed">花钥从不存储你的密码，没有密码库就没有密码库被盗。</p>
      </div>
      <div class="flex gap-2 items-start">
        <AppIcon name="lock" :size="18" class="shrink-0 mt-0.5 text-orange-500" />
        <p class="text-gray-500 dark:text-gray-400 leading-relaxed">AES-256-GCM 加密，完全离线，记忆密码从不上传。</p>
      </div>
    </div>
    <button @click="$emit('done')" class="w-full py-2 bg-blue-500 text-white rounded text-sm hover:bg-blue-600">
      开始使用
    </button>
  </div>
</template>

<script setup lang="ts">
import AppIcon from '../icons/AppIcon.vue';
defineEmits<{ done: [] }>();
</script>
