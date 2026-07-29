<!--
  花钥 - 条目新建/编辑表单
-->
<template>
  <div class="fixed inset-0 bg-black/30 flex items-end justify-center z-50" @click.self="$emit('cancel')">
    <div class="bg-white dark:bg-gray-900 w-full max-h-[85vh] rounded-t-2xl overflow-y-auto">
      <!-- 拖拽指示条 -->
      <div class="flex justify-center pt-3 pb-1"><div class="w-10 h-1 bg-gray-200 dark:bg-gray-700 rounded-full"></div></div>

      <div class="px-4 pb-4">
        <div class="flex justify-between items-center mb-4">
          <h3 class="text-sm font-semibold dark:text-gray-100">{{ entry ? '编辑' : '新建' }}{{ typeLabel }}</h3>
          <button @click="$emit('cancel')" class="w-6 h-6 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">&times;</button>
        </div>

        <div class="space-y-3">
          <!-- 密码条目字段 -->
            <div class="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs">
              <button @click="pwdMode = 'generate'" :class="['flex-1 py-1.5 rounded-md transition-colors', pwdMode === 'generate' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm font-medium' : 'text-gray-500']">生成模式</button>
              <button @click="pwdMode = 'store'" :class="['flex-1 py-1.5 rounded-md transition-colors', pwdMode === 'store' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm font-medium' : 'text-gray-500']">存储模式</button>
            </div>
            <template v-if="pwdMode === 'generate'">
              <input v-model="form.codename" placeholder="区分代号（如 微信、支付宝、GitHub）" class="input" />
              <p class="text-[10px] text-gray-400 dark:text-gray-500 -mt-2">区分代号中的英文字母不区分大小写。</p>
              <div v-if="pwdPreview" @click="copyPreview" class="flex items-center gap-2 px-3 py-1.5 bg-blue-50 dark:bg-blue-900/30 rounded-lg -mt-1 cursor-pointer active:opacity-70">
                <code class="text-xs text-blue-700 dark:text-blue-300 flex-1 break-all">{{ maskPwd(pwdPreview) }}</code>
                <span class="text-[10px] text-blue-400 shrink-0">{{ previewCopied ? '已复制' : '点击复制' }}</span>
              </div>
              <p class="text-[10px] text-gray-400 dark:text-gray-500 -mt-1">密码由记忆密码、身份密语和区分代号共同生成。三项输入相同，即可在任意设备重建同一密码。</p>
              <input v-model="form.url" placeholder="网站地址（可选，如 github.com）" class="input" />
              <div class="flex gap-2">
                <select v-model="form.charsetMode" class="input flex-[3]">
                  <option value="alphanumeric">字母+数字</option>
                  <option value="with_symbols">含特殊字符</option>
                </select>
                <select v-model.number="form.passwordLength" class="input flex-[2]">
                  <option :value="8">8位（旧系统）</option>
                  <option :value="16">16位（默认）</option>
                  <option :value="32">32位</option>
                </select>
              </div>
            </template>
            <template v-else>
              <input v-model="form.codename" placeholder="名称（如 github）" class="input" />
              <div class="relative">
                <input v-model="form.storedPassword" :type="showPwd ? 'text' : 'password'" placeholder="密码（加密存储）" class="input pr-10" autocomplete="new-password" />
                <button type="button" @click="showPwd = !showPwd" class="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-[10px]">{{ showPwd ? '隐藏' : '显示' }}</button>
              </div>
            </template>
          <!-- 标签 combobox -->
          <div class="relative">
            <input v-model="tagInput" placeholder="添加标签，回车确认" class="input"
              @keydown.enter.prevent="addTag"
              @focus="showTagDrop = true" @blur="hideTagDrop" />
            <ul v-if="showTagDrop && tagOptions.length"
              class="absolute z-10 w-full mt-0.5 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg shadow-lg max-h-32 overflow-y-auto text-xs">
              <li v-for="t in tagOptions" :key="t"
                @mousedown.prevent="addTagValue(t)"
                class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer">{{ t }}</li>
            </ul>
            <div v-if="selectedTags.length" class="flex flex-wrap gap-1 mt-1.5">
              <span v-for="t in selectedTags" :key="t"
                class="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-[11px]">
                {{ t }}
                <button @click="removeTag(t)" class="leading-none hover:text-red-500">&times;</button>
              </span>
            </div>
          </div>

          <input v-model="form.folder" placeholder="文件夹（可选）" class="input" list="entry-folders-list" />
          <datalist id="entry-folders-list">
            <option v-for="folder in props.folders ?? []" :key="folder" :value="folder" />
          </datalist>

          <textarea v-model="form.description" placeholder="备注（可选）" rows="2" class="input resize-none" />

          <button @click="save"
            :disabled="!form.codename.trim()"
            class="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors">
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import type { Entry } from '@flowerkey/core';
import { useMainStore } from '../stores/main';

const props = defineProps<{
  entry?: Entry;
  initialMode?: 'generate' | 'store';
  initialUrl?: string;
  folders?: string[];
  tags?: string[];
}>();
const emit = defineEmits<{ save: [Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>]; cancel: [] }>();

const typeLabel = '密码';

const mainStore = useMainStore();
const pwdMode = ref<'generate' | 'store'>(props.initialMode || 'generate');
const showPwd = ref(false);
const pwdPreview = ref('');
const previewCopied = ref(false);

function copyPreview() {
  if (!pwdPreview.value) return;
  navigator.clipboard.writeText(pwdPreview.value);
  previewCopied.value = true;
  setTimeout(() => { previewCopied.value = false; }, 1500);
}
const form = ref({
  codename: '', charsetMode: 'alphanumeric' as const,
  passwordLength: 16, storedPassword: '', url: '', description: '', folder: '',
});

// 标签
const selectedTags = ref<string[]>([]);
const tagInput = ref('');
const showTagDrop = ref(false);

const tagOptions = computed(() =>
  (props.tags ?? []).filter(t => !selectedTags.value.includes(t) && t.toLowerCase().includes(tagInput.value.toLowerCase()))
);

function addTag() {
  const v = tagInput.value.trim();
  if (v && !selectedTags.value.includes(v)) selectedTags.value.push(v);
  tagInput.value = '';
}
function addTagValue(t: string) {
  if (!selectedTags.value.includes(t)) selectedTags.value.push(t);
  tagInput.value = '';
  showTagDrop.value = false;
}
function removeTag(t: string) { selectedTags.value = selectedTags.value.filter(x => x !== t); }
function maskPwd(p: string) { return p.length <= 10 ? p : p.slice(0, 5) + '•••••' + p.slice(-5); }
watch([() => form.value.codename, () => form.value.charsetMode, () => form.value.passwordLength], async ([codename]) => {
  if (mainStore.isUnlocked && pwdMode.value === 'generate' && codename.trim()) {
    pwdPreview.value = await mainStore.genPassword(codename, form.value.charsetMode, form.value.passwordLength);
  } else {
    pwdPreview.value = '';
  }
});

function hideTagDrop() { setTimeout(() => { showTagDrop.value = false; }, 150); }

onMounted(() => {
  if (props.entry) {
    Object.assign(form.value, props.entry);
    selectedTags.value = [...(props.entry.tags ?? [])];
    if (props.entry.storedPassword) pwdMode.value = 'store';
  } else if (props.initialUrl) {
    form.value.url = props.initialUrl;
  }
});

function save() {
  emit('save', {
    type: 'password',
    tags: [...selectedTags.value],
    folder: form.value.folder,
    description: form.value.description,
    ...(pwdMode.value === 'generate' && {
      codename: form.value.codename,
      charsetMode: form.value.charsetMode, passwordLength: form.value.passwordLength,
      storedPassword: undefined,
      ...(form.value.url && { url: form.value.url }),
    }),
    ...(pwdMode.value === 'store' && {
      codename: form.value.codename,
      charsetMode: undefined,
      passwordLength: undefined,
      storedPassword: form.value.storedPassword,
      ...(form.value.url && { url: form.value.url }),
    }),
  });
}
</script>
