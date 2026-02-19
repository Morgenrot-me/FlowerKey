<!--
  花钥移动端 - 根组件
  根据状态显示：设置页 / 解锁页 / 主界面
-->
<template>
  <div class="h-screen flex flex-col bg-gray-50 select-none">
    <SetupPage v-if="!main.isSetup" @done="main.checkSetup()" />
    <UnlockPage v-else-if="!main.isUnlocked" @unlocked="onUnlocked" />
    <MainLayout v-else @lock="main.lock()" />
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue';
import { useMainStore } from './stores/main';
import SetupPage from './pages/SetupPage.vue';
import UnlockPage from './pages/UnlockPage.vue';
import MainLayout from './pages/MainLayout.vue';

const main = useMainStore();
onMounted(() => main.checkSetup());
function onUnlocked() { /* isUnlocked 已由 store 更新 */ }
</script>
