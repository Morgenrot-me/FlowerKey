<!--
  花钥桌面端 - 根组件
-->
<template>
  <div class="h-screen flex flex-col bg-gray-50 select-none">
    <Transition name="fade" mode="out-in">
      <OnboardingPage v-if="!main.isSetup && !showSetup" key="onboarding" @done="showSetup = true" />
      <SetupPage v-else-if="!main.isSetup" key="setup" @done="main.checkSetup()" />
      <UnlockPage v-else-if="!main.isUnlocked" key="unlock" @unlocked="() => {}" />
      <MainLayout v-else key="main" @lock="main.lock()" />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useMainStore } from './stores/main';
import OnboardingPage from './pages/OnboardingPage.vue';
import SetupPage from './pages/SetupPage.vue';
import UnlockPage from './pages/UnlockPage.vue';
import MainLayout from './pages/MainLayout.vue';

const main = useMainStore();
const showSetup = ref(false);
onMounted(() => main.checkSetup());
</script>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
