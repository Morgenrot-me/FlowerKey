<!-- 花钥桌面端 - 加密秘密库。与移动端共享 FK-SECRET-1 载荷。 -->
<template>
  <div class="h-full flex flex-col">
    <div class="px-4 py-3 border-b flex gap-2">
      <input v-model="searchQuery" aria-label="搜索秘密" placeholder="搜索标题、标签或文件夹" class="flex-1 px-3 py-2 border rounded-lg text-sm outline-none focus:border-blue-400" />
      <button @click="openNew" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm">新建</button>
    </div>
    <div class="flex-1 overflow-y-auto divide-y">
      <button v-for="item in filtered" :key="item.entry.id" @click="openEdit(item.entry, item.payload)" class="w-full px-4 py-3 text-left hover:bg-gray-50">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 rounded-lg bg-gray-100 flex items-center justify-center text-sm text-gray-500">{{ kindMark[item.payload.kind] }}</div>
          <div class="min-w-0 flex-1"><p class="font-medium truncate text-sm">{{ item.payload.title || kindLabel[item.payload.kind] }}</p><p class="text-xs text-gray-400 truncate">{{ buildMeta(item.payload, item.entry.updatedAt) }}</p></div>
          <span class="text-gray-300">›</span>
        </div>
      </button>
      <div v-if="!filtered.length" class="p-8 text-center text-sm text-gray-400">{{ searchQuery ? '没有匹配的秘密' : '暂无秘密。API Key、团队账号、恢复码等都可以保存在这里。' }}</div>
    </div>

    <div v-if="showForm" class="fixed inset-0 z-50 bg-white flex flex-col">
      <header class="px-4 min-h-[52px] border-b flex items-center gap-2">
        <button @click="requestClose" class="text-blue-500">取消</button>
        <h2 class="flex-1 text-center font-medium">{{ editingId ? '编辑秘密' : '新建秘密' }}</h2>
        <button @click="save" :disabled="saving || !form.content.trim()" class="text-blue-500 font-medium disabled:opacity-40">{{ saving ? '保存中' : '保存' }}</button>
      </header>
      <main class="flex-1 overflow-y-auto px-6 py-5 space-y-4 max-w-2xl w-full mx-auto">
        <label class="field-group"><span>类型</span><select v-model="form.kind" class="input"><option v-for="kind in kinds" :key="kind" :value="kind">{{ kindLabel[kind] }}</option></select></label>
        <label class="field-group"><span>标题</span><input ref="titleInput" v-model="form.title" maxlength="120" placeholder="例如：生产环境 API" class="input" /></label>
        <label v-if="form.kind === 'credential'" class="field-group"><span>账号</span><input v-model="form.username" autocomplete="off" placeholder="用户名、邮箱或账号" class="input" /></label>
        <div class="field-group"><div class="flex justify-between items-center"><span>秘密内容</span><button @click="showContent = !showContent" class="text-xs text-blue-500 px-2">{{ showContent ? '隐藏' : '显示' }}</button></div>
          <textarea v-model="form.content" :class="['input min-h-[180px] resize-y font-mono', !showContent && 'secret-masked']" spellcheck="false" autocomplete="off" placeholder="需要保密的内容" />
          <button v-if="form.content" @click="copyContent" class="w-full py-2.5 border rounded-xl text-sm">复制秘密内容</button>
        </div>
        <div class="grid grid-cols-2 gap-3"><label class="field-group"><span>文件夹</span><input v-model="form.folder" class="input" /></label><label class="field-group"><span>标签</span><input v-model="tagText" placeholder="逗号分隔" class="input" /></label></div>
        <label class="field-group"><span>备注</span><textarea v-model="form.description" rows="3" class="input resize-y" /></label>
        <p class="text-xs text-gray-400">以上字段会作为一个整体加密后保存与同步。</p>
        <button v-if="editingId" @click="remove" class="w-full py-3 border border-red-300 text-red-500 rounded-xl text-sm">删除秘密</button>
      </main>
    </div>
    <ConfirmDialog :visible="confirmVisible" :title="confirmOpts.title" :message="confirmOpts.message" :confirm-text="confirmOpts.confirmText" :cancel-text="confirmOpts.cancelText" :danger="confirmOpts.danger" @confirm="onConfirm" @cancel="onCancel" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, ref } from 'vue';
import { createSecretPayload, parseSecretPayload, serializeSecretPayload, type Entry, type SecretKind, type SecretPayload } from '@flowerkey/core';
import { useEntriesStore } from '../stores/entries';
import { useConfirm } from '../../../ui/src/composables/useConfirm';
import ConfirmDialog from '../../../ui/src/components/ConfirmDialog.vue';

const store = useEntriesStore();
const { visible: confirmVisible, options: confirmOpts, ask, onConfirm, onCancel } = useConfirm();
const kinds: SecretKind[] = ['text', 'credential', 'token', 'key', 'recovery'];
const kindLabel: Record<SecretKind, string> = { text: '普通秘密', credential: '账号凭据', token: 'API Key / Token', key: '密钥 / 私钥', recovery: '恢复码' };
const kindMark: Record<SecretKind, string> = { text: '密', credential: '账', token: '令', key: '钥', recovery: '恢' };
const searchQuery = ref(''); const showForm = ref(false); const showContent = ref(false); const editingId = ref(''); const saving = ref(false); const tagText = ref('');
const titleInput = ref<HTMLInputElement | null>(null);
const form = ref(createSecretPayload());
let initialSerialized = '';
let clipboardTimer: ReturnType<typeof setTimeout> | undefined;
const items = computed(() => store.entries.flatMap(entry => { const payload = parseSecretPayload(entry.content); return payload ? [{ entry, payload }] : []; }));
const filtered = computed(() => { const q = searchQuery.value.trim().toLocaleLowerCase('zh-CN'); return q ? items.value.filter(({ payload }) => [payload.title, payload.folder, payload.username, ...payload.tags].some(value => value.toLocaleLowerCase('zh-CN').includes(q))) : items.value; });
onMounted(() => store.load('secret'));
function normalizeForm() { return createSecretPayload({ ...form.value, tags: tagText.value.split(/[,，]/).map(v => v.trim()).filter(Boolean) }); }
function buildMeta(payload: SecretPayload, updatedAt: number) { const scope = [payload.folder, ...payload.tags].filter(Boolean).join(' · '); return `${kindLabel[payload.kind]}${scope ? ` · ${scope}` : ''} · ${new Date(updatedAt).toLocaleDateString('zh-CN')}`; }
async function focusTitle() { await nextTick(); titleInput.value?.focus(); }
function openNew() { editingId.value = ''; form.value = createSecretPayload(); tagText.value = ''; showContent.value = true; initialSerialized = serializeSecretPayload(normalizeForm()); showForm.value = true; void focusTitle(); }
function openEdit(entry: Entry, payload: SecretPayload) { editingId.value = entry.id; form.value = createSecretPayload(payload); tagText.value = payload.tags.join(', '); showContent.value = false; initialSerialized = serializeSecretPayload(normalizeForm()); showForm.value = true; }
async function requestClose() { if (serializeSecretPayload(normalizeForm()) !== initialSerialized && !await ask('当前秘密尚未保存，确定放弃吗？', { title: '放弃修改？', danger: true, confirmText: '放弃' })) return; showForm.value = false; }
async function save() { if (!form.value.content.trim() || saving.value) return; saving.value = true; const data = { type: 'secret' as const, content: serializeSecretPayload(normalizeForm()), title: '', description: '', tags: [], folder: '' }; try { if (editingId.value) await store.update(editingId.value, data); else await store.create(data); showForm.value = false; } finally { saving.value = false; } }
async function remove() { if (!await ask('删除后会通过同步传播到其他设备，且无法恢复。', { title: '删除秘密？', danger: true, confirmText: '删除' })) return; await store.remove(editingId.value); showForm.value = false; }
async function copyContent() {
  const copied = form.value.content;
  await navigator.clipboard.writeText(copied);
  clearTimeout(clipboardTimer);
  clipboardTimer = setTimeout(async () => {
    try {
      if (await navigator.clipboard.readText() === copied) await navigator.clipboard.writeText('');
    } catch { /* 浏览器拒绝读取剪贴板时不覆盖用户当前内容 */ }
  }, 60000);
  if (editingId.value) await store.touchLastUsed(editingId.value);
}
</script>

<style scoped>
.field-group { display: grid; gap: 6px; font-size: 12px; color: #6b7280; }
.input { width: 100%; border: 1px solid #d1d5db; border-radius: 10px; padding: 11px 12px; outline: none; }
.input:focus { border-color: #60a5fa; }
.secret-masked { -webkit-text-security: disc; text-security: disc; }
</style>
