<!--
  花钥 - 确认对话框组件
  替代原生 confirm()，支持自定义样式和深色模式
-->
<template>
  <Teleport to="body">
    <Transition name="confirm-overlay">
      <div v-if="visible" class="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/40" @click.self="cancel">
        <Transition name="confirm-dialog" appear>
          <div v-if="visible" class="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-sm overflow-hidden">
            <div class="p-5">
              <h3 v-if="title" class="text-base font-semibold text-gray-900 dark:text-gray-100 mb-2">{{ title }}</h3>
              <p class="text-sm text-gray-600 dark:text-gray-300 leading-relaxed">{{ message }}</p>
            </div>
            <div class="flex border-t dark:border-gray-700">
              <button @click="cancel"
                class="flex-1 py-3 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                {{ cancelText }}
              </button>
              <button @click="confirm"
                :class="['flex-1 py-3 text-sm font-medium transition-colors border-l dark:border-gray-700',
                  danger ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20' : 'text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/20']">
                {{ confirmText }}
              </button>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  visible: boolean;
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}>(), {
  title: '',
  confirmText: '确认',
  cancelText: '取消',
  danger: false,
});

const emit = defineEmits<{ confirm: []; cancel: [] }>();
function confirm() { emit('confirm'); }
function cancel() { emit('cancel'); }
</script>

<style>
.confirm-overlay-enter-active, .confirm-overlay-leave-active { transition: opacity 0.15s ease; }
.confirm-overlay-enter-from, .confirm-overlay-leave-to { opacity: 0; }
.confirm-dialog-enter-active { transition: all 0.2s ease; }
.confirm-dialog-leave-active { transition: all 0.1s ease; }
.confirm-dialog-enter-from { opacity: 0; transform: scale(0.95); }
.confirm-dialog-leave-to { opacity: 0; transform: scale(0.95); }
</style>
