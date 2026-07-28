<!--
  花钥移动端 - 锁定态首屏
  提供正式密码直算、登入数据库与恢复码入口。
-->
<template>
  <div class="flex-1 min-h-0 overflow-y-auto px-5 py-6 pb-[calc(24px+env(safe-area-inset-bottom,0px))] flex flex-col gap-4">
    <h1 class="text-2xl font-bold text-center text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2">
      <img src="../assets/key.png" class="w-10 h-10 object-contain" /> 花钥
    </h1>
    <p class="text-xs text-center text-gray-400 dark:text-gray-500">主密码不存储，数据库密钥仅存于内存，锁定后立即清除</p>
    <div class="rounded-3xl border border-gray-200/80 dark:border-gray-700 bg-white/90 dark:bg-gray-900/80 shadow-sm px-4 py-4">
      <UnlockForm @unlocked="emit('unlocked')" />
    </div>
    <button @click="showHintDialog = true" class="text-xs text-gray-400 dark:text-gray-500">我忘记了记忆密码</button>

    <div v-if="showHintDialog" class="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-5" @click.self="closeHintDialog">
      <div class="w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-5 shadow-xl space-y-3">
        <h2 class="text-base font-semibold dark:text-gray-100">记忆密码提示</h2>
        <p v-if="main.masterPasswordHint" class="text-sm text-gray-600 dark:text-gray-300">{{ main.masterPasswordHint }}</p>
        <p v-else class="text-sm text-orange-600 dark:text-orange-300">你还没有设置提示。请现在写下一个只帮助你回忆的提示，完成后才能关闭。</p>
        <textarea v-if="!main.masterPasswordHint" v-model="hintDraft" rows="3" autofocus placeholder="例如：我在某本书上留下的短句（不要写出密码本身）" class="w-full px-3 py-2 border rounded-xl text-sm dark:bg-gray-900 dark:border-gray-600 dark:text-gray-100" />
        <p v-if="hintError" class="text-xs text-red-500">{{ hintError }}</p>
        <div class="flex gap-2">
          <button v-if="main.masterPasswordHint" @click="closeHintDialog" class="flex-1 py-2.5 border rounded-xl text-sm dark:border-gray-600 dark:text-gray-200">关闭</button>
          <button v-else @click="saveHint" class="flex-1 py-2.5 bg-blue-500 text-white rounded-xl text-sm">保存提示</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import UnlockForm from '../../../ui/src/components/UnlockForm.vue';
import { useMainStore } from '../stores/main';
import { ref } from 'vue';

const emit = defineEmits<{ unlocked: [] }>();
const main = useMainStore();
const showHintDialog = ref(false);
const hintDraft = ref('');
const hintError = ref('');
function closeHintDialog() { if (main.masterPasswordHint) showHintDialog.value = false; }
async function saveHint() {
  hintError.value = '';
  try { await main.saveMasterPasswordHint(hintDraft.value); showHintDialog.value = false; }
  catch (e) { hintError.value = e instanceof Error ? e.message : '保存失败'; }
}
</script>
