<!--
  花钥移动端 - 根组件
  根据状态显示：引导页 / 设置页 / 解锁页 / 强制改密页 / 主界面
-->
<template>
  <div class="h-screen flex flex-col bg-gray-50 dark:bg-gray-900 select-none" style="padding-top: env(safe-area-inset-top)">
    <template v-if="ready">
      <Transition name="fade" mode="out-in">
        <AutofillPromptPage v-if="showAutofillPrompt" key="autofill-prompt" @done="onAutofillPromptDone" />
        <OnboardingPage v-else-if="!main.isSetup && !showSetup" key="onboarding" @done="showSetup = true" />
        <SetupPage v-else-if="!main.isSetup" key="setup" @done="handleSetupDone" />
        <UnlockPage v-else-if="!main.isUnlocked" key="unlock" @unlocked="onUnlocked" />
        <ForceResetPage v-else-if="main.needsPasswordReset" key="reset" />
        <MainLayout v-else key="main" @lock="main.lock()" />
      </Transition>
    </template>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref } from 'vue';
import { useMainStore } from './stores/main';
import { useEntriesStore } from './stores/entries';
import { Capacitor, registerPlugin } from '@capacitor/core';
import OnboardingPage from './pages/OnboardingPage.vue';
import SetupPage from './pages/SetupPage.vue';
import UnlockPage from './pages/UnlockPage.vue';
import ForceResetPage from './pages/ForceResetPage.vue';
import MainLayout from './pages/MainLayout.vue';
import AutofillPromptPage from './pages/AutofillPromptPage.vue';

const AutofillState = registerPlugin<{
  checkEnabled(): Promise<{ enabled: boolean }>;
}>('AutofillState');

const main = useMainStore();
const entries = useEntriesStore();
const ready = ref(false);
const showSetup = ref(false);
const showAutofillPrompt = ref(false);

onMounted(async () => { await main.checkSetup(); ready.value = true; });
async function onUnlocked() { await entries.load('password'); }

async function handleSetupDone() {
  await main.checkSetup();
  if (Capacitor.getPlatform() === 'android') {
    const r = await AutofillState.checkEnabled().catch(() => ({ enabled: false }));
    if (!r.enabled) { showAutofillPrompt.value = true; return; }
  }
}

function onAutofillPromptDone() {
  showAutofillPrompt.value = false;
}
</script>

<style>
.fade-enter-active, .fade-leave-active { transition: opacity 0.15s ease; }
.fade-enter-from, .fade-leave-to { opacity: 0; }
</style>
