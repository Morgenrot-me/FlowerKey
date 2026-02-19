<!--
  花钥移动端 - 设置 Tab
-->
<template>
  <div class="h-full overflow-y-auto px-4 py-4 flex flex-col gap-4">
    <div class="bg-white rounded-xl divide-y">
      <div class="px-4 py-3 flex items-center justify-between">
        <span class="text-sm">版本</span>
        <span class="text-sm text-gray-400">0.1.0</span>
      </div>
    </div>
    <button @click="$emit('lock')" class="w-full py-3 border border-red-300 text-red-500 rounded-xl text-sm">
      锁定
    </button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{ lock: [] }>();
</script>
