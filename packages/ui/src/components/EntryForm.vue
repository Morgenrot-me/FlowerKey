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
          <template v-if="type === 'password'">
            <div class="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg text-xs">
              <button @click="pwdMode = 'generate'" :class="['flex-1 py-1.5 rounded-md transition-colors', pwdMode === 'generate' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm font-medium' : 'text-gray-500']">生成模式</button>
              <button @click="pwdMode = 'store'" :class="['flex-1 py-1.5 rounded-md transition-colors', pwdMode === 'store' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm font-medium' : 'text-gray-500']">存储模式</button>
            </div>
            <template v-if="pwdMode === 'generate'">
              <input v-model="form.codename" placeholder="区分代号（如 github、gmail）" class="input" />
              <p class="text-[10px] text-gray-400 dark:text-gray-500 -mt-1">相同主密码+代号在任何设备生成相同密码，数据丢失也可还原。</p>
              <input v-model="form.salt" placeholder="自定义盐（可选）" class="input" />
              <div class="flex gap-2">
                <select v-model="form.charsetMode" class="input flex-1">
                  <option value="alphanumeric">字母+数字</option>
                  <option value="with_symbols">含特殊字符</option>
                </select>
                <select v-model.number="form.passwordLength" class="input w-20">
                  <option :value="8">8位</option>
                  <option :value="16">16位</option>
                  <option :value="24">24位</option>
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
          </template>

          <!-- 书签/文件引用字段 -->
          <template v-if="type === 'bookmark' || type === 'file_ref'">
            <input v-model="form.title" :placeholder="type === 'file_ref' ? '文件名' : '标题'" class="input" />
            <input v-model="form.url" :placeholder="type === 'file_ref' ? '原地址 URL' : 'URL'" class="input" />
          </template>

          <!-- 笔记字段 -->
          <template v-if="type === 'note'">
            <input v-model="form.title" placeholder="标题（可选）" class="input" />
            <textarea v-model="form.content" placeholder="笔记内容（端到端加密）" rows="6" class="input resize-none" />
          </template>

          <!-- 公共字段：文件夹 combobox -->
          <div class="relative" ref="folderRef">
            <input v-model="form.folder" placeholder="文件夹（如 工作）" class="input"
              @focus="showFolderDrop = true" @blur="hideFolderDrop" />
            <ul v-if="showFolderDrop && folderOptions.length"
              class="absolute z-10 w-full mt-0.5 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-lg shadow-lg max-h-32 overflow-y-auto text-xs">
              <li v-for="f in folderOptions" :key="f"
                @mousedown.prevent="form.folder = f; showFolderDrop = false"
                class="px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer">{{ f }}</li>
            </ul>
          </div>

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

          <textarea v-model="form.description" placeholder="备注（可选）" rows="2" class="input resize-none" />

          <button @click="save"
            :disabled="(type === 'password' && !form.codename.trim()) || (type === 'note' && !form.content.trim())"
            class="w-full py-2.5 bg-blue-500 text-white rounded-xl text-sm font-medium hover:bg-blue-600 disabled:opacity-40 transition-colors">
            保存
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Entry, EntryType } from '@flowerkey/core';

const props = defineProps<{
  entry?: Entry;
  type: EntryType;
  initialMode?: 'generate' | 'store';
  folders?: string[];
  tags?: string[];
}>();
const emit = defineEmits<{ save: [Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>]; cancel: [] }>();

const typeLabel = computed(() => ({ password: '密码', bookmark: '书签', file_ref: '文件引用', note: '笔记' }[props.type] ?? ''));

const pwdMode = ref<'generate' | 'store'>(props.initialMode || 'generate');
const showPwd = ref(false);
const form = ref({
  codename: '', salt: '', charsetMode: 'alphanumeric' as const,
  passwordLength: 16, storedPassword: '', title: '', url: '',
  content: '', folder: '', description: '',
});

// 标签
const selectedTags = ref<string[]>([]);
const tagInput = ref('');
const showFolderDrop = ref(false);
const showTagDrop = ref(false);

const folderOptions = computed(() =>
  (props.folders ?? []).filter(f => f && f !== '/' && f.toLowerCase().includes(form.value.folder.toLowerCase()))
);
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
function hideFolderDrop() { setTimeout(() => { showFolderDrop.value = false; }, 150); }
function hideTagDrop() { setTimeout(() => { showTagDrop.value = false; }, 150); }

onMounted(() => {
  if (props.entry) {
    Object.assign(form.value, props.entry);
    selectedTags.value = [...(props.entry.tags ?? [])];
    if (props.entry.storedPassword) pwdMode.value = 'store';
  }
});

function save() {
  emit('save', {
    type: props.type,
    tags: selectedTags.value,
    folder: form.value.folder || '/',
    description: form.value.description,
    ...(props.type === 'password' && pwdMode.value === 'generate' && {
      codename: form.value.codename, salt: form.value.salt,
      charsetMode: form.value.charsetMode, passwordLength: form.value.passwordLength,
    }),
    ...(props.type === 'password' && pwdMode.value === 'store' && {
      codename: form.value.codename, storedPassword: form.value.storedPassword,
    }),
    ...((props.type === 'bookmark' || props.type === 'file_ref') && { title: form.value.title, url: form.value.url }),
    ...(props.type === 'note' && { title: form.value.title, content: form.value.content }),
  });
}
</script>

<style scoped>
.input { @apply w-full px-3 py-2 border rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-blue-400/50 focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 transition-colors; }
</style>
