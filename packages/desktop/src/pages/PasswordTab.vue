<!--
  花钥桌面端 - 密码 Tab
-->
<template>
  <div class="h-full flex flex-col">
    <div class="px-4 py-3 border-b flex gap-2">
      <input v-model="store.searchQuery" placeholder="搜索区分代号..."
        class="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-400" />
      <button @click="openNew" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">+ 新建</button>
    </div>

    <!-- 标签过滤行 -->
    <div v-if="store.tags.length" class="flex gap-1 px-4 py-2 flex-wrap border-b">
      <button
        v-for="t in store.tags" :key="t"
        @click="toggleTag(t)"
        :class="['px-2 py-0.5 rounded text-xs', store.selectedTags.includes(t) ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-500']"
      >{{ t }}</button>
    </div>

    <div class="flex-1 overflow-y-auto divide-y">
      <div v-for="e in store.filtered" :key="e.id" class="px-4 py-3 flex items-center gap-3">
        <div class="flex-1 min-w-0 cursor-pointer" @click="openEdit(e)">
          <div class="font-medium truncate">{{ e.codename }}</div>
          <div class="text-xs text-gray-400 truncate">{{ e.description }}</div>
        </div>
        <button @click="generate(e)" :class="['px-3 py-1.5 rounded-lg text-sm font-medium',
          copiedId === e.id ? 'bg-green-100 text-green-600' : 'bg-blue-50 text-blue-600']">
          {{ copiedId === e.id ? '已复制' : '生成' }}
        </button>
        <button @click="remove(e.id)" class="px-2 py-1.5 rounded-lg text-sm text-red-400 hover:bg-red-50">删除</button>
      </div>
      <div v-if="!store.filtered.length" class="p-8 text-center text-sm text-gray-400">暂无密码条目，点击右上角新建</div>
    </div>

    <!-- 新建/编辑表单 -->
    <div v-if="showForm" class="absolute inset-0 bg-white flex flex-col">
      <div class="px-4 py-3 border-b flex items-center gap-3">
        <button @click="closeForm" class="text-blue-500">取消</button>
        <span class="flex-1 text-center font-medium">{{ editingId ? '编辑密码条目' : '新建密码条目' }}</span>
        <button @click="save" class="text-blue-500 font-medium">保存</button>
      </div>
      <div class="flex-1 px-4 py-4 flex flex-col gap-3 overflow-y-auto">
        <!-- 模式切换 -->
        <div class="flex gap-1 p-1 bg-gray-100 rounded-xl text-sm">
          <button @click="pwdMode = 'generate'" :class="['flex-1 py-2 rounded-lg transition-colors', pwdMode === 'generate' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500']">生成模式</button>
          <button @click="pwdMode = 'store'" :class="['flex-1 py-2 rounded-lg transition-colors', pwdMode === 'store' ? 'bg-white text-blue-600 shadow-sm font-medium' : 'text-gray-500']">存储模式</button>
        </div>

        <!-- 生成模式 -->
        <template v-if="pwdMode === 'generate'">
          <input v-model="form.codename" placeholder="区分代号（必填，如 github）" class="input" />
          <div v-if="formPwdPreview" @click="copyPreview" class="flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-xl -mt-1 cursor-pointer hover:opacity-80">
            <code class="text-sm text-blue-700 flex-1 break-all">{{ maskPwd(formPwdPreview) }}</code>
            <span class="text-xs text-blue-400 shrink-0">{{ previewCopied ? '已复制' : '点击复制' }}</span>
          </div>
          <p class="text-xs text-gray-400 px-1">密码 = 记忆密码 + 区分代号，缺一不可。相同的记忆密码+代号在任何设备都生成相同密码，数据丢失也可还原。</p>
          <div class="flex gap-2">
            <select v-model="form.charsetMode" class="flex-1 input">
              <option value="alphanumeric">字母+数字</option>
              <option value="with_symbols">含特殊字符</option>
            </select>
            <select v-model.number="form.passwordLength" class="w-24 input">
              <option :value="8">8位</option>
              <option :value="16">16位</option>
              <option :value="24">24位</option>
              <option :value="32">32位</option>
            </select>
          </div>
        </template>

        <!-- 存储模式 -->
        <template v-else>
          <input v-model="form.codename" placeholder="名称（如 github）" class="input" />
          <div class="relative">
            <input v-model="form.storedPassword" :type="showPwd ? 'text' : 'password'" placeholder="密码（加密存储）" class="input pr-16" autocomplete="new-password" />
            <button type="button" @click="showPwd = !showPwd" class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">{{ showPwd ? '隐藏' : '显示' }}</button>
          </div>
        </template>

        <input v-model="form.description" placeholder="描述（可选）" class="input" />

        <!-- 标签 -->
        <div>
          <input v-model="tagInput" placeholder="添加标签，回车确认" @keydown.enter.prevent="addTag" class="input" />
          <div v-if="form.tags.length" class="flex flex-wrap gap-1 mt-2">
            <span v-for="t in form.tags" :key="t"
              class="flex items-center gap-1 px-2 py-0.5 bg-blue-100 text-blue-700 rounded-full text-xs">
              {{ t }}<button @click="removeTag(t)" class="leading-none">&times;</button>
            </span>
          </div>
        </div>

        <input v-model="form.url" placeholder="网站地址（可选，如 github.com）" class="input" />
      </div>
    </div>
    <ConfirmDialog :visible="confirmVisible" :title="confirmOpts.title" :message="confirmOpts.message"
      :danger="confirmOpts.danger" @confirm="onConfirm" @cancel="onCancel" />
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue';
import { useEntriesStore } from '../stores/entries';
import { useMainStore } from '../stores/main';
import { useConfirm } from '../../../ui/src/composables/useConfirm';
import ConfirmDialog from '../../../ui/src/components/ConfirmDialog.vue';
import type { Entry } from '@flowerkey/core';

const store = useEntriesStore();
const main = useMainStore();
const { visible: confirmVisible, options: confirmOpts, ask, onConfirm, onCancel } = useConfirm();
const copiedId = ref('');
const showForm = ref(false);
const editingId = ref('');
const pwdMode = ref<'generate' | 'store'>('generate');
const showPwd = ref(false);
const tagInput = ref('');
const formPwdPreview = ref('');
const previewCopied = ref(false);

const form = ref({
  codename: '', description: '', url: '',
  charsetMode: 'alphanumeric' as 'alphanumeric' | 'with_symbols',
  passwordLength: 16, storedPassword: '', tags: [] as string[],
});

onMounted(() => store.load('password'));

watch([() => form.value.codename, () => form.value.charsetMode, () => form.value.passwordLength], async ([codename]) => {
  if (pwdMode.value === 'generate' && (codename as string).trim()) {
    formPwdPreview.value = await main.genPassword(codename as string, form.value.charsetMode, form.value.passwordLength);
  } else {
    formPwdPreview.value = '';
  }
});
watch(pwdMode, () => { formPwdPreview.value = ''; });

function maskPwd(p: string) { return p.length <= 10 ? p : p.slice(0, 5) + '•••••' + p.slice(-5); }

async function copyPreview() {
  if (!formPwdPreview.value) return;
  await navigator.clipboard.writeText(formPwdPreview.value);
  previewCopied.value = true;
  setTimeout(() => { previewCopied.value = false; }, 1500);
}

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
function removeTag(t: string) { form.value.tags = form.value.tags.filter(x => x !== t); }

const emptyForm = () => ({
  codename: '', description: '', url: '',
  charsetMode: 'alphanumeric' as 'alphanumeric' | 'with_symbols',
  passwordLength: 16, storedPassword: '', tags: [] as string[],
});

function openNew() {
  editingId.value = '';
  pwdMode.value = 'generate';
  showPwd.value = false;
  tagInput.value = '';
  form.value = emptyForm();
  showForm.value = true;
}

function openEdit(e: Entry) {
  editingId.value = e.id;
  pwdMode.value = e.storedPassword ? 'store' : 'generate';
  showPwd.value = false;
  tagInput.value = '';
  form.value = {
    codename: e.codename || '', description: e.description || '', url: e.url || '',
    charsetMode: (e.charsetMode as 'alphanumeric' | 'with_symbols') || 'alphanumeric',
    passwordLength: e.passwordLength || 16,
    storedPassword: e.storedPassword || '',
    tags: [...(e.tags || [])],
  };
  showForm.value = true;
}

function closeForm() {
  showForm.value = false;
  editingId.value = '';
  pwdMode.value = 'generate';
  showPwd.value = false;
  tagInput.value = '';
  form.value = emptyForm();
}

async function generate(e: Entry) {
  const pwd = e.storedPassword || await main.genPassword(e.codename!, e.charsetMode || 'alphanumeric', e.passwordLength || 16);
  await navigator.clipboard.writeText(pwd);
  copiedId.value = e.id;
  setTimeout(() => { copiedId.value = ''; }, 1500);
}

async function save() {
  if (!form.value.codename.trim()) return;
  const data: Partial<Entry> = {
    codename: form.value.codename.trim(),
    description: form.value.description,
    url: form.value.url || undefined,
    tags: form.value.tags,
    folder: '',
  };
  if (pwdMode.value === 'generate') {
    data.charsetMode = form.value.charsetMode;
    data.passwordLength = form.value.passwordLength;
    data.storedPassword = undefined;
  } else {
    data.storedPassword = form.value.storedPassword || undefined;
  }
  if (editingId.value) {
    await store.update(editingId.value, data);
  } else {
    await store.create({ type: 'password', ...data, tags: data.tags ?? [], folder: '' });
  }
  closeForm();
}

async function remove(id: string) {
  if (!await ask('确认删除此条目？', { title: '删除确认', danger: true })) return;
  await store.remove(id);
}
</script>
