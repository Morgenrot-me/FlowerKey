<!--
  花钥移动端 - 锁定态首屏
  提供正式密码直算、登入数据库与恢复码入口。
-->
<template>
  <div class="flex-1 flex flex-col justify-center px-5 py-6 gap-4">
    <h1 class="text-2xl font-bold text-center text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2">
      <img src="../assets/key.png" class="w-10 h-10 object-contain" /> 花钥
    </h1>
    <p class="text-xs text-center text-gray-400 dark:text-gray-500">主密码不存储，数据库密钥仅存于内存，锁定后立即清除</p>
    <div class="rounded-3xl border border-gray-200/80 dark:border-gray-700 bg-white/90 dark:bg-gray-900/80 shadow-sm px-4 py-4">
      <UnlockForm @unlocked="emit('unlocked')" />
    </div>
  </div>
</template>

<script setup lang="ts">
import UnlockForm from '../../../ui/src/components/UnlockForm.vue';

const emit = defineEmits<{ unlocked: [] }>();
</script>
