<!--
  花钥移动端 - 主界面（底部 Tab 导航 / 平板侧边栏）
-->
<template>
  <div class="flex-1 flex overflow-hidden">
    <!-- 平板侧边栏（md 及以上显示） -->
    <nav class="hidden md:flex flex-col w-20 border-r bg-white dark:bg-gray-900 dark:border-gray-700 py-4 gap-1 shrink-0">
      <!-- Logo -->
      <div class="mb-4 flex justify-center">
        <img src="../assets/key.png" class="w-8 h-8 object-contain opacity-90" alt="花钥" />
      </div>

      <button v-for="t in tabs" :key="t.key" @click="switchTab(t.key)"
        :class="['flex flex-col items-center gap-1 py-3 mx-2 rounded-xl text-xs transition-colors',
          tab === t.key ? 'bg-blue-50 text-blue-500 dark:bg-blue-900/30' : 'text-gray-400 dark:text-gray-500']">
        <AppIcon :name="t.icon" :size="24" />
        <span>{{ t.label }}</span>
      </button>

      <div class="flex-1"></div>

      <!-- 锁定 -->
      <button @click="requestLock"
        class="flex flex-col items-center gap-1 py-3 mx-2 rounded-xl text-xs text-gray-400 dark:text-gray-500 transition-colors">
        <AppIcon name="lock" :size="22" />
        <span>锁定</span>
      </button>
    </nav>

    <!-- 内容区 -->
    <div class="flex-1 flex flex-col overflow-hidden">
      <!-- 手机顶部栏（md 以上隐藏） -->
      <header class="md:hidden flex items-center justify-between px-4 py-2 border-b bg-white dark:bg-gray-900 dark:border-gray-700">
        <div class="flex items-center gap-2">
          <img src="../assets/key.png" class="w-5 h-5 object-contain" alt="花钥" />
          <span class="text-sm font-bold text-blue-600 dark:text-blue-400">花钥</span>
        </div>
        <button @click="requestLock" aria-label="锁定花钥" class="w-11 h-11 flex items-center justify-center rounded-lg text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
          <AppIcon name="lock" :size="18" />
        </button>
      </header>

      <div class="flex-1 overflow-hidden md:max-w-2xl md:mx-auto md:w-full">
        <PasswordTab v-if="tab === 'password'" @editing-change="isEditing = $event" />
        <NoteTab v-else-if="tab === 'note'" @editing-change="isEditing = $event" />
        <SettingsTab v-else-if="tab === 'settings'" @lock="$emit('lock')" />
      </div>

      <!-- 手机底部 Tab（md 以上隐藏） -->
      <nav class="md:hidden flex min-h-[56px] border-t bg-white dark:bg-gray-900 dark:border-gray-700" style="padding-bottom: env(safe-area-inset-bottom, 0px)">
        <button v-for="t in tabs" :key="t.key" @click="switchTab(t.key)"
          :class="['flex-1 py-3 flex flex-col items-center gap-0.5 text-xs transition-colors',
            tab === t.key ? 'text-blue-500' : 'text-gray-400 dark:text-gray-500']">
          <AppIcon :name="t.icon" :size="20" />
          <span>{{ t.label }}</span>
        </button>
      </nav>
    </div>
    <ConfirmDialog :visible="confirmVisible" :title="confirmOpts.title" :message="confirmOpts.message"
      :confirm-text="confirmOpts.confirmText" :cancel-text="confirmOpts.cancelText" :danger="confirmOpts.danger"
      @confirm="onConfirm" @cancel="onCancel" />
  </div>
</template>

<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { App } from '@capacitor/app';
import AppIcon from '../../../ui/src/icons/AppIcon.vue';
import ConfirmDialog from '../../../ui/src/components/ConfirmDialog.vue';
import { useConfirm } from '../../../ui/src/composables/useConfirm';
import { useEntriesStore } from '../stores/entries';
import PasswordTab from './PasswordTab.vue';
import NoteTab from './NoteTab.vue';
import SettingsTab from './SettingsTab.vue';

const emit = defineEmits<{ lock: [] }>();
const tab = ref('password');
const isEditing = ref(false);
const entries = useEntriesStore();
const { visible: confirmVisible, options: confirmOpts, ask, onConfirm, onCancel } = useConfirm();
const tabs = [
  { key: 'password', icon: 'password' as const, label: '密码' },
  { key: 'note', icon: 'note' as const, label: '秘密' },
  { key: 'settings', icon: 'settings' as const, label: '设置' },
];

async function switchTab(next: string) {
  if (next === tab.value) return;
  if (isEditing.value && !await ask('当前表单尚未关闭，切换页面将放弃未保存内容。', { title: '放弃编辑？', danger: true, confirmText: '放弃并切换' })) return;
  entries.searchQuery = '';
  entries.selectedTags.splice(0);
  isEditing.value = false;
  tab.value = next;
}

async function requestLock() {
  if (isEditing.value && !await ask('当前表单尚未关闭，锁定将放弃未保存内容。', { title: '锁定花钥？', danger: true, confirmText: '放弃并锁定' })) return;
  emit('lock');
}

let removeBackListener: (() => Promise<void>) | undefined;
onMounted(async () => {
  const listener = await App.addListener('backButton', async () => {
    if (confirmVisible.value) { onCancel(); return; }
    if (tab.value !== 'password') { await switchTab('password'); return; }
    await requestLock();
  });
  removeBackListener = () => listener.remove();
});
onBeforeUnmount(() => { void removeBackListener?.(); });
</script>
