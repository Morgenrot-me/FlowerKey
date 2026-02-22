<!--
  花钥移动端 - 根组件
  根据状态显示：设置页 / 解锁页 / 强制改密页 / 主界面
-->
<template>
  <div class="h-screen flex flex-col bg-gray-50 select-none" style="padding-top: env(safe-area-inset-top)">
    <SetupPage v-if="!main.isSetup" @done="main.checkSetup()" />
    <UnlockPage v-else-if="!main.isUnlocked" @unlocked="onUnlocked" />
    <ForceResetPage v-else-if="main.needsPasswordReset" />
    <MainLayout v-else @lock="main.lock()" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useMainStore } from './stores/main';
import { useEntriesStore } from './stores/entries';
import SetupPage from './pages/SetupPage.vue';
import UnlockPage from './pages/UnlockPage.vue';
import ForceResetPage from './pages/ForceResetPage.vue';
import MainLayout from './pages/MainLayout.vue';

const main = useMainStore();
const entries = useEntriesStore();
onMounted(() => main.checkSetup());
async function onUnlocked() {
  await entries.load('password');
}
</script>
