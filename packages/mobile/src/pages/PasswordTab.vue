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
    <div v-if="store.tags.length" class="flex gap-1 px-4 py-2 flex-wrap border-b dark:border-gray-700">
      <button
        v-for="t in store.tags" :key="t"
        @click="toggleTag(t)"
        :class="['px-2 py-0.5 rounded text-xs', store.selectedTags.includes(t) ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/50 dark:text-blue-300' : 'bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-300']"
      >{{ t }}</button>
    </div>

    <!-- 自动填充提示 Banner（Android，未启用且未关闭时显示） -->
    <div v-if="showAutofillBanner" class="mx-4 mt-3 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl flex items-center gap-2">
      <p class="flex-1 text-xs text-blue-700 dark:text-blue-300">启用自动填充，在任何 App 中一键填充密码</p>
      <button @click="openAutofill" class="text-xs text-blue-500 font-medium shrink-0">去开启</button>
      <button @click="dismissBanner" class="text-gray-400 text-xs ml-1">✕</button>
    </div>

    <div class="flex-1 overflow-y-auto divide-y dark:divide-gray-700">
      <div v-for="e in store.filtered" :key="e.id" class="px-4 py-3 flex items-center gap-3">
        <div class="flex-1 min-w-0 cursor-pointer" @click="openEdit(e)">
          <div class="font-medium truncate dark:text-gray-100">{{ e.codename }}</div>
          <div class="text-xs text-gray-500 dark:text-gray-400 truncate">{{ buildMeta(e) }}</div>
          <div v-if="e.description" class="text-xs text-gray-400 dark:text-gray-500 truncate mt-0.5">{{ e.description }}</div>
        </div>
        <button @click="generate(e)" :class="['px-3 py-1.5 rounded-lg text-sm font-medium',
          copiedId === e.id ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400' : 'bg-blue-50 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400']">
          {{ copiedId === e.id ? '已复制' : '生成' }}
        </button>
      </div>
      <div v-if="!store.filtered.length" class="p-8 text-center flex flex-col gap-3">
        <p class="text-sm text-gray-400 dark:text-gray-500">{{ store.entries?.length ? '无匹配结果' : '暂无密码条目，点击右上角新建' }}</p>
        <div v-if="!store.entries?.length" class="mx-auto w-full max-w-sm rounded-2xl border border-blue-200/70 bg-blue-50/80 dark:border-blue-900/50 dark:bg-blue-900/20 px-4 py-3 text-left text-xs text-blue-700 dark:text-blue-300 space-y-1.5 leading-relaxed">
          <p class="font-medium text-blue-800 dark:text-blue-200">1 分钟上手</p>
          <p>1. 新建一个区分代号，例如 github-main</p>
          <p>2. 点击生成，密码会自动复制到剪贴板</p>
          <p>3. 去登录页直接粘贴，后续还能按最近使用更快找到</p>
        </div>
      </div>
    </div>

    <!-- 新建/编辑表单 -->
    <Transition name="slide-up">
      <div v-if="showForm" class="absolute inset-0 bg-white dark:bg-gray-900 flex flex-col z-10" style="padding-top: env(safe-area-inset-top)">
      <div class="px-4 py-3 border-b dark:border-gray-700 flex items-center gap-3">
        <button @click="closeForm" class="text-blue-500">取消</button>
        <span class="flex-1 text-center font-medium dark:text-gray-100">{{ editingId ? '编辑密码条目' : '新建密码条目' }}</span>
        <button @click="save" class="text-blue-500 font-medium">保存</button>
      </div>
      <div class="flex-1 px-4 py-4 flex flex-col gap-3 overflow-y-auto">
        <!-- 模式切换 -->
        <div class="flex gap-1 p-1 bg-gray-100 dark:bg-gray-800 rounded-xl text-sm">
          <button @click="pwdMode = 'generate'" :class="['flex-1 py-2 rounded-lg transition-colors', pwdMode === 'generate' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm font-medium' : 'text-gray-500 dark:text-gray-400']">生成模式</button>
          <button @click="pwdMode = 'store'" :class="['flex-1 py-2 rounded-lg transition-colors', pwdMode === 'store' ? 'bg-white dark:bg-gray-700 text-blue-600 shadow-sm font-medium' : 'text-gray-500 dark:text-gray-400']">存储模式</button>
        </div>

        <!-- 生成模式 -->
        <template v-if="pwdMode === 'generate'">
          <input v-model="form.codename" placeholder="区分代号（必填，如 github）" class="input" />
          <div v-if="formPwdPreview" @click="copyPreview" class="flex items-center gap-2 px-3 py-2 bg-blue-50 dark:bg-blue-900/30 rounded-xl -mt-1 cursor-pointer active:opacity-70">
            <code class="text-sm text-blue-700 dark:text-blue-300 flex-1 break-all">{{ maskPwd(formPwdPreview) }}</code>
            <span class="text-xs text-blue-400 shrink-0">{{ previewCopied ? '已复制' : '点击复制' }}</span>
          </div>
          <p class="text-xs text-gray-400 dark:text-gray-500 px-1">密码 = 记忆密码 + 区分代号，缺一不可。代号只是"锁的编号"，没有你的记忆密码，任何人拿到代号也无法算出密码。相同的记忆密码+代号在任何设备都生成相同密码，数据丢失也可还原。</p>
          <!-- 高级选项 -->
          <button @click="showAdvanced = !showAdvanced" class="text-xs text-blue-500 text-left px-1">
            {{ showAdvanced ? '▲ 收起高级选项' : '▼ 高级选项' }}
          </button>
          <div v-if="showAdvanced" class="flex gap-2">
            <select v-model="form.charsetMode" class="input" style="flex: 3">
              <option value="alphanumeric">字母+数字</option>
              <option value="with_symbols">含特殊字符</option>
            </select>
            <select v-model.number="form.passwordLength" class="input" style="flex: 2">
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

        <!-- 标签 -->
        <div class="relative">
          <input v-model="tagInput" placeholder="添加标签" @keyup.enter.prevent="addTag"
            @focus="showTagDrop = true" @blur="hideTagDrop" class="input pr-12" />
          <button @mousedown.prevent="addTag" class="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 bg-blue-500 text-white rounded-full text-lg leading-none flex items-center justify-center">+</button>
          <ul v-if="showTagDrop && tagOptions.length"
            class="absolute z-10 w-full mt-0.5 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-xl shadow-lg max-h-32 overflow-y-auto text-sm">
            <li v-for="t in tagOptions" :key="t"
              @mousedown.prevent="addTagValue(t)"
              class="px-3 py-2 hover:bg-blue-50 dark:hover:bg-gray-700 cursor-pointer dark:text-gray-200">{{ t }}</li>
          </ul>
          <div v-if="form.tags.length" class="flex flex-wrap gap-1 mt-2">
            <span v-for="t in form.tags" :key="t"
              class="flex items-center gap-1 px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 rounded-full text-xs">
              {{ t }}<button @click="removeTag(t)" class="leading-none">&times;</button>
            </span>
          </div>
        </div>

        <input v-model="form.description" placeholder="描述（可选）" class="input" />

        <input v-model="form.url" placeholder="网站地址（可用于自动填充，如github.com）" class="input" />
        <div v-if="form.appPackage" class="flex items-center gap-2 px-3 py-2 bg-gray-50 dark:bg-gray-800 border dark:border-gray-600 rounded-xl">
          <span class="text-xs text-gray-400 dark:text-gray-500 shrink-0">关联 App</span>
          <span class="text-sm text-gray-600 dark:text-gray-300 flex-1 truncate">{{ form.appPackage }}</span>
          <template v-if="confirmUnlink">
            <button @click="confirmUnlink = false" class="text-xs text-gray-400 shrink-0">取消</button>
            <button @click="form.appPackage = ''; confirmUnlink = false" class="text-xs text-red-500 font-medium shrink-0">确认解除</button>
          </template>
          <button v-else @click="confirmUnlink = true" class="text-xs text-red-400 shrink-0">解除</button>
        </div>
        <div v-if="editingId" class="px-1 flex gap-4 text-xs text-gray-400 dark:text-gray-500">
          <span v-if="form.createdAt">创建于 {{ fmtDate(form.createdAt, true) }}</span>
          <span v-if="form.lastUsedAt">最近使用 {{ fmtDate(form.lastUsedAt, true) }}</span>
          <span v-else-if="form.createdAt">从未使用</span>
        </div>
        <button v-if="editingId" @click="remove" class="w-full py-3 border border-red-300 dark:border-red-700 text-red-500 dark:text-red-400 rounded-xl text-sm">删除条目</button>
      </div>
    </div>
    </Transition>
    <ConfirmDialog :visible="confirmVisible" :title="confirmOpts.title" :message="confirmOpts.message"
      :confirm-text="confirmOpts.confirmText" :cancel-text="confirmOpts.cancelText" :danger="confirmOpts.danger"
      @confirm="onConfirm" @cancel="onCancel" />
    <Toast :visible="toast.visible.value" :message="toast.message.value" :type="toast.type.value" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useEntriesStore } from '../stores/entries';
import { useMainStore } from '../stores/main';
import { Clipboard } from '@capacitor/clipboard';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { useConfirm } from '../../../ui/src/composables/useConfirm';
import { useToast } from '../../../ui/src/composables/useToast';
import ConfirmDialog from '../../../ui/src/components/ConfirmDialog.vue';
import Toast from '../../../ui/src/components/Toast.vue';
import type { Entry } from '@flowerkey/core';

const AutofillState = registerPlugin<{
  checkEnabled(): Promise<{ enabled: boolean }>;
  openSettings(): Promise<void>;
}>('AutofillState');

const store = useEntriesStore();
const main = useMainStore();
const { visible: confirmVisible, options: confirmOpts, ask, onConfirm, onCancel } = useConfirm();
const toast = useToast();
const copiedId = ref('');
const showForm = ref(false);
const editingId = ref('');
const pwdMode = ref<'generate' | 'store'>('generate');
const showPwd = ref(false);
const confirmUnlink = ref(false);
const showAdvanced = ref(false);
const showTagDrop = ref(false);
const tagInput = ref('');
const form = ref({
  codename: '', description: '', url: '', appPackage: '',
  createdAt: 0, lastUsedAt: 0,
  charsetMode: 'alphanumeric' as 'alphanumeric' | 'with_symbols',
  passwordLength: 16,
  storedPassword: '',
  tags: [] as string[],
});
const formPwdPreview = ref('');
const previewCopied = ref(false);

async function copyPreview() {
  if (!formPwdPreview.value) return;
  await Clipboard.write({ string: formPwdPreview.value });
  if (editingId.value) await store.touchLastUsed(editingId.value);
  previewCopied.value = true;
  setTimeout(async () => {
    await Clipboard.write({ string: '' });
    previewCopied.value = false;
  }, 60000);
}
function maskPwd(p: string) { return p.length <= 10 ? p : p.slice(0, 5) + '•••••' + p.slice(-5); }
function fmtDate(ts?: number, withYear = false) {
  if (!ts) return '未使用';
  return new Date(ts).toLocaleDateString('zh-CN', withYear
    ? { year: 'numeric', month: '2-digit', day: '2-digit' }
    : { month: '2-digit', day: '2-digit' });
}
function buildMeta(e: Entry) {
  const mode = e.storedPassword ? '已存储' : (e.charsetMode === 'with_symbols' ? '含特殊字符' : '字母+数字');
  const length = e.storedPassword ? '自定义密码' : `${e.passwordLength || 16}位`;
  return `${length} · ${mode} · 最近使用 ${fmtDate(e.lastUsedAt)}`;
}

const tagOptions = computed(() =>
  store.tags.filter(t => !form.value.tags.includes(t) && t.toLowerCase().includes(tagInput.value.toLowerCase()))
);
function addTagValue(t: string) { if (!form.value.tags.includes(t)) form.value.tags.push(t); tagInput.value = ''; showTagDrop.value = false; }
function hideTagDrop() { setTimeout(() => { showTagDrop.value = false; }, 150); }

// 自动填充 Banner
const BANNER_DISMISSED_KEY = 'autofill_banner_dismissed';
const showAutofillBanner = ref(false);

async function openAutofill() {
  await AutofillState.openSettings().catch(() => {});
  setTimeout(async () => {
    const r = await AutofillState.checkEnabled().catch(() => ({ enabled: false }));
    if (r.enabled) {
      showAutofillBanner.value = false;
      toast.show('自动填充已开启，可去任意登录框测试', 'success');
    } else {
      toast.show('尚未开启，请在系统自动填充设置中选择花钥', 'info');
    }
  }, 500);
}

function dismissBanner() {
  showAutofillBanner.value = false;
  localStorage.setItem(BANNER_DISMISSED_KEY, '1');
}

watch([() => form.value.codename, () => form.value.charsetMode, () => form.value.passwordLength], async ([codename]) => {
  if (pwdMode.value === 'generate' && (codename as string).trim()) {
    formPwdPreview.value = await main.genPassword(codename as string, form.value.charsetMode, form.value.passwordLength);
  } else {
    formPwdPreview.value = '';
  }
});
watch(pwdMode, () => { formPwdPreview.value = ''; });

onMounted(async () => {
  store.load('password');
  if (Capacitor.getPlatform() === 'android' && !localStorage.getItem(BANNER_DISMISSED_KEY)) {
    const r = await AutofillState.checkEnabled().catch(() => ({ enabled: false }));
    showAutofillBanner.value = !r.enabled;
  }
});

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
  codename: '', description: '', url: '', appPackage: '',
  createdAt: 0, lastUsedAt: 0,
  charsetMode: 'alphanumeric' as 'alphanumeric' | 'with_symbols',
  passwordLength: 16, storedPassword: '', tags: [] as string[],
});

function openNew() {
  editingId.value = '';
  pwdMode.value = 'generate';
  showPwd.value = false;
  showAdvanced.value = false;
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
    appPackage: e.appPackage || '', createdAt: e.createdAt || 0, lastUsedAt: e.lastUsedAt || 0,
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
  showAdvanced.value = false;
  tagInput.value = '';
  form.value = emptyForm();
}

async function generate(e: Entry) {
  const pwd = e.storedPassword || await main.genPassword(e.codename!, e.charsetMode || 'alphanumeric', e.passwordLength || 16);
  await Clipboard.write({ string: pwd });
  await store.touchLastUsed(e.id);
  copiedId.value = e.id;
  toast.show('密码已复制到剪贴板', 'success');
  setTimeout(() => { copiedId.value = ''; }, 1500);
  // 60秒后清空剪贴板
  setTimeout(async () => { await Clipboard.write({ string: '' }); }, 60000);
}

async function save() {
  if (!form.value.codename.trim()) return;
  const data: Partial<Entry> = {
    codename: form.value.codename.trim(),
    description: form.value.description,
    url: form.value.url || undefined,
    appPackage: form.value.appPackage || undefined,
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

async function remove() {
  if (!await ask('确认删除此条目？', { title: '删除确认', danger: true })) return;
  await store.remove(editingId.value);
  closeForm();
}
</script>
