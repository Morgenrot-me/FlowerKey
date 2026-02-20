<!--
  花钥桌面端 - 根组件
-->
<template>
  <div class="h-screen flex flex-col bg-gray-50 select-none">
    <SetupPage v-if="!main.isSetup" @done="main.checkSetup()" />
    <UnlockPage v-else-if="!main.isUnlocked" @unlocked="() => {}" />
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
</script>
