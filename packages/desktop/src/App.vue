<!--
  花钥桌面端 - 根组件
-->
<template>
  <div class="h-screen flex flex-col bg-gray-50 select-none">
    <Transition name="fade" mode="out-in">
      <div v-if="main.hasUnsupportedMasterData" key="unsupported" class="m-auto max-w-md rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-700 space-y-2">
        <p class="font-medium">检测到发布前或损坏的花钥数据</p>
        <p>为避免覆盖原配置并孤立已有加密条目，花钥已停止初始化。请先清除本地开发数据，再重新打开花钥。</p>
      </div>
      <OnboardingPage v-else-if="!main.isSetup && !showSetup" key="onboarding" @done="showSetup = true" />
      <SetupPage v-else-if="!main.isSetup" key="setup" @done="main.checkSetup()" />
      <UnlockPage v-else-if="!main.isUnlocked" key="unlock" @unlocked="onUnlocked" />
      <MainLayout v-else key="main" @lock="main.lock()" />
    </Transition>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useMainStore } from './stores/main';
import { useEntriesStore } from './stores/entries';
import OnboardingPage from './pages/OnboardingPage.vue';
import SetupPage from './pages/SetupPage.vue';
import UnlockPage from './pages/UnlockPage.vue';
import MainLayout from './pages/MainLayout.vue';

const main = useMainStore();
const entries = useEntriesStore();
const showSetup = ref(false);
onMounted(() => main.checkSetup());

async function onUnlocked() { await entries.load('password'); }
</script>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
