<!--
  花钥移动端 - 书签 Tab
-->
<template>
  <div class="h-full flex flex-col">
    <div class="px-4 py-3 border-b dark:border-gray-700 flex gap-2">
      <input v-model="store.searchQuery" placeholder="搜索书签..."
        class="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
      <button @click="showForm = true" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">+ 新建</button>
    </div>

    <!-- 标签过滤行 -->
    <div v-if="store.tags.length" class="flex gap-1 px-4 py-2 flex-wrap border-b dark:border-gray-700">
      <button
        v-for="t in store.tags" :key="t"
        @click="toggleTag(t)"
        :class="['px-2 py-0.5 rounded text-xs', store.selectedTags.includes(t) ? 'bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300' : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400']"
      >{{ t }}</button>
    </div>

    <div class="flex-1 overflow-y-auto divide-y dark:divide-gray-700">
      <div v-for="e in store.filtered" :key="e.id" class="px-4 py-3 flex items-center gap-3">
        <div class="flex-1 min-w-0 cursor-pointer active:bg-gray-50 dark:active:bg-gray-800 -mx-4 px-4 py-2 -my-2 rounded transition-colors" @click="openEdit(e)">
          <div class="font-medium truncate dark:text-gray-100">{{ e.title || '未命名' }}</div>
          <div class="text-xs text-blue-400 truncate">{{ e.url }}</div>
          <div v-if="e.description" class="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{{ e.description }}</div>
          <div v-if="e.tags?.length" class="flex gap-1 mt-1">
            <span v-for="t in e.tags" :key="t" class="px-1 bg-gray-100 dark:bg-gray-700 rounded text-[10px] dark:text-gray-300">{{ t }}</span>
          </div>
        </div>
        <button @click="confirmDelete(e.id)" class="text-red-400 dark:text-red-500 text-sm px-2">删除</button>
      </div>
      <div v-if="!store.filtered.length" class="p-8 text-center text-sm text-gray-400 dark:text-gray-500">暂无书签</div>
    </div>

    <Transition name="slide-up">
      <div v-if="showForm" class="fixed inset-0 bg-white dark:bg-gray-900 flex flex-col z-50" style="padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom, 0px)">
        <div class="px-4 py-3 border-b dark:border-gray-700 flex items-center gap-3">
          <button @click="showForm = false; editingId = ''; form = { title: '', url: '', tags: [], description: '' }" class="text-blue-500">取消</button>
          <span class="flex-1 text-center font-medium dark:text-gray-100">{{ editingId ? '编辑书签' : '新建书签' }}</span>
          <button @click="save" class="text-blue-500 font-medium">保存</button>
        </div>
        <div class="flex-1 px-4 py-4 flex flex-col gap-3 overflow-y-auto">
          <input v-model="form.title" placeholder="标题" class="w-full px-3 py-3 border rounded-xl text-base outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
          <input v-model="form.url" placeholder="URL" type="url" class="w-full px-3 py-3 border rounded-xl text-base outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />

          <!-- 标签 -->
          <div>
            <input v-model="tagInput" placeholder="添加标签，回车确认" @keydown.enter.prevent="addTag" class="w-full px-3 py-3 border rounded-xl text-base outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
            <div v-if="form.tags.length" class="flex flex-wrap gap-1 mt-2">
              <span v-for="t in form.tags" :key="t"
                class="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-full text-xs">
                {{ t }}<button @click="removeTag(t)" class="leading-none">&times;</button>
              </span>
            </div>
          </div>

          <textarea v-model="form.description" placeholder="描述（可选）" rows="2" class="w-full px-3 py-3 border rounded-xl text-base outline-none focus:border-blue-400 resize-none dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
        </div>
      </div>
    </Transition>
    <ConfirmDialog :visible="confirmVisible" :title="confirmOpts.title" :message="confirmOpts.message"
      :danger="confirmOpts.danger" @confirm="onConfirm" @cancel="onCancel" />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useEntriesStore } from '../stores/entries';
import { useConfirm } from '../../../ui/src/composables/useConfirm';
import ConfirmDialog from '../../../ui/src/components/ConfirmDialog.vue';
import type { Entry } from '@flowerkey/core';

const store = useEntriesStore();
const emit = defineEmits<{ 'editing-change': [value: boolean] }>();
const { visible: confirmVisible, options: confirmOpts, ask, onConfirm, onCancel } = useConfirm();
const showForm = ref(false);
const editingId = ref('');
const tagInput = ref('');
const form = ref({ title: '', url: '', tags: [] as string[], description: '' });
watch(showForm, value => emit('editing-change', value));

onMounted(() => store.load('bookmark'));

function toggleTag(t: string) {
  const idx = store.selectedTags.indexOf(t);
  if (idx >= 0) store.selectedTags.splice(idx, 1);
  else store.selectedTags.push(t);
}

function addTag() {
  const v = tagInput.value.trim();
  if (v && !form.value.tags.includes(v)) form.value.tags.push(v);
  tagInput.value = '';
}

function removeTag(t: string) {
  form.value.tags = form.value.tags.filter(x => x !== t);
}

function openEdit(e: Entry) {
  editingId.value = e.id;
  form.value = {
    title: e.title || '',
    url: e.url || '',
    tags: [...(e.tags || [])],
    description: e.description || ''
  };
  showForm.value = true;
}

async function confirmDelete(id: string) {
  if (await ask('确定删除此书签？', { title: '删除确认', danger: true })) store.remove(id);
}

async function save() {
  if (!form.value.url.trim()) return;
  if (editingId.value) {
    await store.update(editingId.value, {
      title: form.value.title,
      url: form.value.url.trim(),
      tags: form.value.tags,
      description: form.value.description
    });
  } else {
    await store.create({
      type: 'bookmark',
      title: form.value.title,
      url: form.value.url.trim(),
      tags: form.value.tags,
      folder: '',
      description: form.value.description
    });
  }
  form.value = { title: '', url: '', tags: [], description: '' };
  editingId.value = '';
  tagInput.value = '';
  showForm.value = false;
}
</script>
