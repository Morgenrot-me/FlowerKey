<!--
  花钥浏览器端秘密库。
  仅在解锁后解析 FK-SECRET-1，列表不展示秘密内容。
-->
<template>
  <div class="h-full flex flex-col">
    <div class="px-3 py-2 border-b dark:border-gray-700 flex gap-2">
      <input v-model="searchQuery" aria-label="搜索秘密" placeholder="搜索标题、标签或文件夹" class="input flex-1" />
      <button @click="openNew" class="min-h-11 px-3 bg-blue-500 text-white rounded text-xs">新建</button>
    </div>

    <div class="flex-1 overflow-y-auto divide-y dark:divide-gray-700">
      <button v-for="item in filtered" :key="item.entry.id" @click="openEdit(item.entry, item.payload)" class="w-full min-h-14 px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800">
        <div class="flex items-center gap-2">
          <div class="w-9 h-9 shrink-0 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-xs text-gray-500">{{ kindMark[item.payload.kind] }}</div>
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate text-xs">{{ item.payload.title || kindLabel[item.payload.kind] }}</p>
            <p class="text-[11px] text-gray-400 truncate">{{ buildMeta(item.payload, item.entry.updatedAt) }}</p>
          </div>
          <span class="text-gray-300 dark:text-gray-600" aria-hidden="true"><AppIcon name="chevron-right" :size="16" /></span>
        </div>
      </button>
      <div v-if="!filtered.length" class="p-6 text-center text-xs text-gray-400">
        {{ searchQuery ? '没有匹配的秘密' : '暂无秘密。API Key、团队账号、恢复码等都可以保存在这里。' }}
      </div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col" role="dialog" aria-modal="true" aria-labelledby="secret-form-title">
      <header class="px-3 min-h-[52px] border-b dark:border-gray-700 flex items-center gap-2">
        <button @click="requestClose" class="min-w-11 min-h-11 text-blue-500 text-xs">取消</button>
        <h2 id="secret-form-title" class="flex-1 text-center text-sm font-medium">{{ editingId ? '编辑秘密' : '新建秘密' }}</h2>
        <button @click="save" :disabled="saving || !form.content.trim()" class="min-w-11 min-h-11 text-blue-500 text-xs font-medium disabled:opacity-40">{{ saving ? '保存中' : '保存' }}</button>
      </header>
      <main class="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <label class="field-group"><span>类型</span><select v-model="form.kind" class="input"><option v-for="kind in kinds" :key="kind" :value="kind">{{ kindLabel[kind] }}</option></select></label>
        <label class="field-group"><span>标题</span><input ref="titleInput" v-model="form.title" maxlength="120" placeholder="例如：生产环境 API" class="input" /></label>
        <label v-if="form.kind === 'credential'" class="field-group"><span>账号</span><input v-model="form.username" autocomplete="off" placeholder="用户名、邮箱或账号" class="input" /></label>
        <div class="field-group">
          <div class="flex items-center justify-between"><span>秘密内容</span><button @click="showContent = !showContent" class="min-h-11 px-2 text-xs text-blue-500">{{ showContent ? '隐藏' : '显示' }}</button></div>
          <textarea v-model="form.content" :class="['input min-h-36 resize-y font-mono', !showContent && 'secret-masked']" autocomplete="off" spellcheck="false" placeholder="需要保密的内容" />
          <button v-if="form.content" @click="copyContent" class="w-full min-h-11 border dark:border-gray-600 rounded text-xs">复制秘密内容</button>
        </div>
        <label class="field-group"><span>文件夹</span><input v-model="form.folder" maxlength="80" placeholder="可选，例如：工作 / 个人" class="input" /></label>
        <label class="field-group"><span>标签</span><input v-model="tagText" placeholder="多个标签用逗号分隔" class="input" /></label>
        <label class="field-group"><span>备注</span><textarea v-model="form.description" rows="3" placeholder="可选，不会显示在列表中" class="input resize-y" /></label>
        <p class="text-[11px] text-gray-400 leading-relaxed">以上字段会作为一个整体加密后保存与同步。</p>
        <button v-if="editingId" @click="remove" class="w-full min-h-11 border border-red-300 dark:border-red-700 text-red-500 rounded text-xs">删除秘密</button>
      </main>
    </div>

    <ConfirmDialog :visible="confirmVisible" :title="confirmOpts.title" :message="confirmOpts.message" :confirm-text="confirmOpts.confirmText" :cancel-text="confirmOpts.cancelText" :danger="confirmOpts.danger" @confirm="onConfirm" @cancel="onCancel" />
    <Toast :visible="toast.visible.value" :message="toast.message.value" :type="toast.type.value" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { createSecretPayload, parseSecretPayload, serializeSecretPayload, type Entry, type SecretKind, type SecretPayload } from '@flowerkey/core';
import { useEntriesStore } from '../stores/entries';
import { useConfirm } from '../composables/useConfirm';
import { useToast } from '../composables/useToast';
import ConfirmDialog from './ConfirmDialog.vue';
import Toast from './Toast.vue';
import AppIcon from '../icons/AppIcon.vue';

const emit = defineEmits<{ 'editing-change': [value: boolean] }>();
const store = useEntriesStore();
const toast = useToast();
const { visible: confirmVisible, options: confirmOpts, ask, onConfirm, onCancel } = useConfirm();
const kinds: SecretKind[] = ['text', 'credential', 'token', 'key', 'recovery'];
const kindLabel: Record<SecretKind, string> = { text: '普通秘密', credential: '账号凭据', token: 'API Key / Token', key: '密钥 / 私钥', recovery: '恢复码' };
const kindMark: Record<SecretKind, string> = { text: '密', credential: '账', token: '令', key: '钥', recovery: '恢' };
const searchQuery = ref('');
const showForm = ref(false);
const showContent = ref(false);
const editingId = ref('');
const saving = ref(false);
const tagText = ref('');
const titleInput = ref<HTMLInputElement | null>(null);
const form = ref(createSecretPayload());
let initialSerialized = '';
let clipboardTimer: ReturnType<typeof setTimeout> | undefined;

const items = computed(() => store.entries.flatMap(entry => {
  const payload = parseSecretPayload(entry.content);
  return payload ? [{ entry, payload }] : [];
}));
const filtered = computed(() => {
  const query = searchQuery.value.trim().toLocaleLowerCase('zh-CN');
  if (!query) return items.value;
  return items.value.filter(({ payload }) => [payload.title, payload.folder, payload.username, ...payload.tags].some(value => value.toLocaleLowerCase('zh-CN').includes(query)));
});

onMounted(() => store.loadEntries('secret'));
onUnmounted(() => clearTimeout(clipboardTimer));
watch(showForm, value => emit('editing-change', value));

function normalizedPayload() {
  return createSecretPayload({ ...form.value, tags: tagText.value.split(/[,，]/).map(tag => tag.trim()).filter(Boolean) });
}

function buildMeta(payload: SecretPayload, updatedAt: number) {
  const scope = [payload.folder, ...payload.tags].filter(Boolean).join(' · ');
  return `${kindLabel[payload.kind]}${scope ? ` · ${scope}` : ''} · ${new Date(updatedAt).toLocaleDateString('zh-CN')}`;
}

async function focusTitle() { await nextTick(); titleInput.value?.focus(); }
function openNew() {
  editingId.value = '';
  form.value = createSecretPayload();
  tagText.value = '';
  showContent.value = true;
  initialSerialized = serializeSecretPayload(normalizedPayload());
  showForm.value = true;
  void focusTitle();
}
function openEdit(entry: Entry, payload: SecretPayload) {
  editingId.value = entry.id;
  form.value = createSecretPayload(payload);
  tagText.value = payload.tags.join(', ');
  showContent.value = false;
  initialSerialized = serializeSecretPayload(normalizedPayload());
  showForm.value = true;
}
async function requestClose() {
  if (serializeSecretPayload(normalizedPayload()) !== initialSerialized && !await ask('当前秘密尚未保存，确定放弃吗？', { title: '放弃修改？', danger: true, confirmText: '放弃' })) return;
  showForm.value = false;
}
async function save() {
  if (!form.value.content.trim() || saving.value) return;
  saving.value = true;
  const data = { type: 'secret' as const, content: serializeSecretPayload(normalizedPayload()), title: '', description: '', tags: [], folder: '' };
  try {
    if (editingId.value) await store.updateEntry(editingId.value, data);
    else await store.createEntry(data);
    showForm.value = false;
    toast.show('秘密已加密保存', 'success');
  } catch { toast.show('保存失败，请重试', 'error'); }
  finally { saving.value = false; }
}
async function remove() {
  if (!await ask('删除后会通过同步传播到其他设备，且无法恢复。', { title: '删除秘密？', danger: true, confirmText: '删除' })) return;
  await store.deleteEntry(editingId.value);
  showForm.value = false;
  toast.show('秘密已删除', 'success');
}
async function copyContent() {
  await navigator.clipboard.writeText(form.value.content);
  clearTimeout(clipboardTimer);
  clipboardTimer = setTimeout(async () => {
    try {
      if (await navigator.clipboard.readText() === form.value.content) await navigator.clipboard.writeText('');
    } catch { /* 浏览器拒绝读取剪贴板时不覆盖用户当前内容 */ }
  }, 60000);
  if (editingId.value) await store.touchLastUsed(editingId.value);
  toast.show('秘密内容已复制，60秒后清除', 'success');
}
</script>

<style scoped>
.field-group { display: grid; gap: 6px; font-size: 11px; color: #6b7280; }
.secret-masked { -webkit-text-security: disc; text-security: disc; }
</style>
