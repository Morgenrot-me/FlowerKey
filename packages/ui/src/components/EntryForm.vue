<!--
  花钥 - 条目新建/编辑表单
-->
<template>
  <div class="fixed inset-0 bg-black/30 flex items-end justify-center z-50">
    <div class="bg-white dark:bg-gray-900 w-full max-h-[80vh] rounded-t-xl p-4 overflow-y-auto">
      <div class="flex justify-between items-center mb-3">
        <h3 class="text-sm font-bold dark:text-gray-100">{{ entry ? '编辑' : '新建' }}{{ typeLabel }}</h3>
        <button @click="$emit('cancel')" class="text-gray-400 text-lg">&times;</button>
      </div>

      <div class="space-y-2 text-xs">
        <!-- 密码条目字段 -->
        <template v-if="type === 'password'">
          <input v-model="form.codename" placeholder="区分代号" class="input" />
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

        <!-- 书签条目字段 -->
        <template v-if="type === 'bookmark'">
          <input v-model="form.title" placeholder="标题" class="input" />
          <input v-model="form.url" placeholder="URL" class="input" />
        </template>

        <!-- 文件引用字段 -->
        <template v-if="type === 'file_ref'">
          <input v-model="form.fileName" placeholder="文件名" class="input" />
          <input v-model="form.sourceUrl" placeholder="原地址URL" class="input" />
        </template>

        <!-- 公共字段 -->
        <input v-model="form.folder" placeholder="文件夹（如 /工作）" class="input" />
        <input v-model="tagsInput" placeholder="标签（逗号分隔）" class="input" />
        <textarea v-model="form.description" placeholder="描述" rows="2" class="input" />

        <button @click="save" class="w-full py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
          保存
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import type { Entry, EntryType } from '@flowerkey/core';

const props = defineProps<{ entry?: Entry; type: EntryType }>();
const emit = defineEmits<{ save: [Omit<Entry, 'id' | 'createdAt' | 'updatedAt'>]; cancel: [] }>();

const typeLabel = computed(() => ({ password: '密码', bookmark: '书签', file_ref: '文件引用' }[props.type]));

const form = ref({
  codename: '', salt: '', charsetMode: 'alphanumeric' as const,
  passwordLength: 16, title: '', url: '', fileName: '',
  sourceUrl: '', folder: '', description: '',
});
const tagsInput = ref('');

onMounted(() => {
  if (props.entry) {
    Object.assign(form.value, props.entry);
    tagsInput.value = props.entry.tags?.join(', ') || '';
  }
});

function save() {
  emit('save', {
    type: props.type,
    tags: tagsInput.value.split(',').map(t => t.trim()).filter(Boolean),
    folder: form.value.folder || '/',
    description: form.value.description,
    ...(props.type === 'password' && {
      codename: form.value.codename,
      salt: form.value.salt,
      charsetMode: form.value.charsetMode,
      passwordLength: form.value.passwordLength,
    }),
    ...(props.type === 'bookmark' && {
      title: form.value.title,
      url: form.value.url,
    }),
    ...(props.type === 'file_ref' && {
      fileName: form.value.fileName,
      sourceUrl: form.value.sourceUrl,
    }),
  });
}
</script>

<style scoped>
.input { @apply w-full px-2 py-1.5 border rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100; }
</style>
