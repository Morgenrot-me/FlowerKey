<!--
  花钥移动端 - 根组件
  根据状态显示：引导页 / 设置页 / 解锁页 / 强制改密页 / 主界面
-->
<template>
  <div class="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 select-none" style="padding-top: env(safe-area-inset-top)">
    <template v-if="ready">
      <OnboardingPage v-if="!main.isSetup && !onboardingSeen" @done="finishOnboarding" />
      <SetupPage v-else-if="!main.isSetup" @done="main.checkSetup()" />
      <UnlockPage v-else-if="!main.isUnlocked" @unlocked="onUnlocked" />
      <ForceResetPage v-else-if="main.needsPasswordReset" />
      <MainLayout v-else @lock="main.lock()" />
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useMainStore } from './stores/main';
import { useEntriesStore } from './stores/entries';
import OnboardingPage from './pages/OnboardingPage.vue';
import SetupPage from './pages/SetupPage.vue';
import UnlockPage from './pages/UnlockPage.vue';
import ForceResetPage from './pages/ForceResetPage.vue';
import MainLayout from './pages/MainLayout.vue';

const main = useMainStore();
const entries = useEntriesStore();
const ready = ref(false);
const onboardingSeen = ref(localStorage.getItem('onboarding_seen') === '1');
function finishOnboarding() { localStorage.setItem('onboarding_seen', '1'); onboardingSeen.value = true; }
onMounted(async () => { await main.checkSetup(); ready.value = true; });
async function onUnlocked() { await entries.load('password'); }
</script>
