<!--
  花钥移动端 - 密码 Tab
-->
<template>
  <div class="h-full flex flex-col">
    <div class="px-4 py-3 border-b dark:border-gray-700 flex gap-2">
      <input v-model="store.searchQuery" placeholder="搜索区分代号..."
        class="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
      <button @click="openNew" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">+ 新建</button>
    </div>

    <div class="flex-1 overflow-y-auto divide-y dark:divide-gray-700">
      <div v-for="e in store.filtered" :key="e.id" class="px-4 py-3 flex items-center gap-3">
        <div class="flex-1 min-w-0 cursor-pointer" @click="openEdit(e)">
          <div class="font-medium truncate dark:text-gray-100">{{ e.codename }}</div>
          <div class="text-xs text-gray-400 dark:text-gray-500 truncate">{{ e.description }}</div>
        </div>
        <button @click="generate(e)" :class="['px-3 py-1.5 rounded-lg text-sm font-medium',
          copiedId === e.id ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400']">
          {{ copiedId === e.id ? '已复制' : '生成' }}
        </button>
      </div>
      <div v-if="!store.filtered.length" class="p-8 text-center text-sm text-gray-400 dark:text-gray-500">暂无密码条目，点击右上角新建</div>
    </div>

    <!-- 新建/编辑表单 -->
    <div v-if="showForm" class="absolute inset-0 bg-white dark:bg-gray-900 flex flex-col" style="padding-top: env(safe-area-inset-top)">
      <div class="px-4 py-3 border-b dark:border-gray-700 flex items-center gap-3">
        <button @click="closeForm" class="text-blue-500">取消</button>
        <span class="flex-1 text-center font-medium dark:text-gray-100">{{ editingId ? '编辑密码条目' : '新建密码条目' }}</span>
        <button @click="save" class="text-blue-500 font-medium">保存</button>
      </div>
      <div class="flex-1 px-4 py-4 flex flex-col gap-3 overflow-y-auto">
        <input v-model="form.codename" placeholder="区分代号（必填，如 github）"
          class="w-full px-3 py-3 border rounded-xl text-base outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
        <div v-if="formPwdPreview" class="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl -mt-1">
          <code class="text-sm text-blue-700 dark:text-blue-300 flex-1 break-all">{{ maskPwd(formPwdPreview) }}</code>
          <span class="text-xs text-blue-400 shrink-0">预览</span>
        </div>
        <p class="text-xs text-gray-400 dark:text-gray-500 px-1">密码 = 记忆密码 + 区分代号，缺一不可。代号只是"钥匙的名字"，没有你的记忆密码，任何人拿到代号也无法算出密码。相同的记忆密码+代号在任何设备都生成相同密码，数据丢失也可还原。</p>
        <input v-model="form.description" placeholder="描述（可选）"
          class="w-full px-3 py-3 border rounded-xl text-base outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
        <input v-model="form.url" placeholder="网站地址（可选，用于自动填充，如 github.com）"
          class="w-full px-3 py-3 border rounded-xl text-base outline-none focus:border-blue-400 dark:bg-gray-800 dark:border-gray-600 dark:text-gray-100 dark:placeholder-gray-500" />
        <button v-if="editingId" @click="remove" class="w-full py-3 border border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 rounded-xl text-sm">删除条目</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue';
import { useEntriesStore } from '../stores/entries';
import { useMainStore } from '../stores/main';
import { Clipboard } from '@capacitor/clipboard';
import type { Entry } from '@flowerkey/core';

const store = useEntriesStore();
const main = useMainStore();
const copiedId = ref('');
const showForm = ref(false);
const editingId = ref('');
const form = ref({ codename: '', description: '', url: '' });
const formPwdPreview = ref('');
function maskPwd(p: string) { return p.length <= 10 ? p : p.slice(0, 5) + '•••••' + p.slice(-5); }

watch(() => form.value.codename, async (codename) => {
  formPwdPreview.value = codename.trim() ? await main.genPassword(codename, 'alphanumeric', 16) : '';
});

onMounted(() => store.load('password'));

function openNew() {
  editingId.value = '';
  form.value = { codename: '', description: '', url: '' };
  showForm.value = true;
}

function openEdit(e: Entry) {
  editingId.value = e.id;
  form.value = { codename: e.codename || '', description: e.description || '', url: e.url || '' };
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingId.value = '';
  form.value = { codename: '', description: '', url: '' };
}

async function generate(e: Entry) {
  const pwd = await main.genPassword(e.codename!, e.charsetMode || 'alphanumeric', e.passwordLength || 16);
  await Clipboard.write({ string: pwd });
  copiedId.value = e.id;
  setTimeout(() => { copiedId.value = ''; }, 1500);
}

async function save() {
  if (!form.value.codename.trim()) return;
  const data = { codename: form.value.codename.trim(), description: form.value.description, url: form.value.url || undefined };
  if (editingId.value) {
    await store.update(editingId.value, data);
  } else {
    await store.create({ type: 'password', ...data, tags: [], folder: '' });
  }
  closeForm();
}

async function remove() {
  if (!confirm('确认删除此条目？')) return;
  await store.remove(editingId.value);
  closeForm();
}
</script>
