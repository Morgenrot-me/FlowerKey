<!--
  花钥 - 密码强度指示条
  实时评估密码强度并给出视觉反馈
-->
<template>
  <div v-if="password.length > 0" class="space-y-1">
    <div class="flex gap-1">
      <div
        v-for="i in 4" :key="i"
        :class="['h-1 flex-1 rounded-full transition-colors duration-200',
          i <= level ? levelColor : 'bg-gray-200 dark:bg-gray-700']"
      />
    </div>
    <p :class="['text-[11px] transition-colors', levelTextColor]">{{ levelText }}</p>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{ password: string }>();

const level = computed(() => {
  const p = props.password;
  if (!p) return 0;
  let score = 0;
  if (p.length >= 4) score++;
  if (p.length >= 8) score++;
  if (/[A-Z]/.test(p) && /[a-z]/.test(p)) score++;
  if (/\d/.test(p)) score++;
  if (/[^A-Za-z0-9]/.test(p)) score++;
  if (p.length >= 12) score++;
  if (score <= 1) return 1;
  if (score <= 2) return 2;
  if (score <= 4) return 3;
  return 4;
});

const levelColor = computed(() => {
  const map: Record<number, string> = {
    1: 'bg-red-500',
    2: 'bg-orange-500',
    3: 'bg-yellow-500',
    4: 'bg-green-500',
  };
  return map[level.value] || '';
});

const levelTextColor = computed(() => {
  const map: Record<number, string> = {
    1: 'text-red-500 dark:text-red-400',
    2: 'text-orange-500 dark:text-orange-400',
    3: 'text-yellow-600 dark:text-yellow-400',
    4: 'text-green-600 dark:text-green-400',
  };
  return map[level.value] || '';
});

const levelText = computed(() => {
  const map: Record<number, string> = {
    1: '弱 — 建议加长或混合不同字符',
    2: '一般 — 建议增加复杂度',
    3: '较强',
    4: '强',
  };
  return map[level.value] || '';
});
</script>
