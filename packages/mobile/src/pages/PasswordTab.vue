<!--
  花钥移动端 - 密码 Tab
-->
<template>
  <div class="h-full flex flex-col">
    <div class="px-4 py-3 border-b flex gap-2">
      <input v-model="store.searchQuery" placeholder="搜索区分代号..."
        class="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-400" />
      <button @click="showForm = true" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">+ 新建</button>
    </div>

    <div class="flex-1 overflow-y-auto divide-y">
      <div v-for="e in store.filtered" :key="e.id" class="px-4 py-3 flex items-center gap-3">
        <div class="flex-1 min-w-0">
          <div class="font-medium truncate">{{ e.codename }}</div>
          <div class="text-xs text-gray-400 truncate">{{ e.description }}</div>
        </div>
        <button @click="generate(e)" :class="['px-3 py-1.5 rounded-lg text-sm font-medium',
          copiedId === e.id ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600']">
          {{ copiedId === e.id ? '已复制' : '生成' }}
        </button>
      </div>
      <div v-if="!store.filtered.length" class="p-8 text-center text-sm text-gray-400">暂无密码条目，点击右上角新建</div>
    </div>

    <!-- 新建表单 -->
    <div v-if="showForm" class="absolute inset-0 bg-white flex flex-col" style="padding-top: env(safe-area-inset-top)">
      <div class="px-4 py-3 border-b flex items-center gap-3">
        <button @click="showForm = false" class="text-blue-500">取消</button>
        <span class="flex-1 text-center font-medium">新建密码条目</span>
        <button @click="save" class="text-blue-500 font-medium">保存</button>
      </div>
      <div class="flex-1 px-4 py-4 flex flex-col gap-3">
        <input v-model="form.codename" placeholder="区分代号（必填，如 github）"
          class="w-full px-3 py-3 border rounded-xl text-base outline-none focus:border-blue-400" />
        <p class="text-xs text-gray-400 px-1">代号用于区分不同网站，相同主密码+代号在任何设备都生成相同密码，即使数据丢失也可还原。</p>
        <input v-model="form.description" placeholder="描述（可选）"
          class="w-full px-3 py-3 border rounded-xl text-base outline-none focus:border-blue-400" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useEntriesStore } from '../stores/entries';
import { useMainStore } from '../stores/main';
import { Clipboard } from '@capacitor/clipboard';

const store = useEntriesStore();
const main = useMainStore();
const copiedId = ref('');
const showForm = ref(false);
const form = ref({ codename: '', description: '' });

onMounted(() => store.load('password'));

async function generate(e: typeof store.filtered[0]) {
  const pwd = await main.genPassword(e.codename!, e.charsetMode || 'alphanumeric', e.passwordLength || 16);
  await Clipboard.write({ string: pwd });
  copiedId.value = e.id;
  setTimeout(() => { copiedId.value = ''; }, 1500);
}

async function save() {
  if (!form.value.codename.trim()) return;
  await store.create({ type: 'password', codename: form.value.codename.trim(), description: form.value.description, tags: [], folder: '' });
  form.value = { codename: '', description: '' };
  showForm.value = false;
}
</script>
