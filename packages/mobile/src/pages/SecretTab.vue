<!-- 花钥移动端 - 加密秘密库。列表不展示秘密内容，详情页按需显示和复制。 -->
<template>
  <div class="h-full flex flex-col">
    <div class="px-4 py-3 border-b dark:border-gray-700 flex gap-2">
      <input v-model="searchQuery" aria-label="搜索秘密" placeholder="搜索标题、标签或文件夹" class="input flex-1 !py-2" />
      <button @click="openNew" class="px-4 py-2 bg-blue-500 text-white rounded-lg text-sm flex items-center gap-1"><AppIcon name="plus" :size="14" /> 新建</button>
    </div>

    <div class="flex-1 overflow-y-auto divide-y dark:divide-gray-700">
      <div v-if="store.loading" class="p-8 text-center text-sm text-gray-400">正在解密秘密库...</div>
      <div v-else-if="store.error" class="p-8 text-center text-sm text-red-500">{{ store.error }}<button @click="store.load('secret')" class="block mx-auto mt-2 text-blue-500">重试</button></div>
      <button v-for="item in filtered" :key="item.entry.id" @click="openEdit(item.entry, item.payload)" class="w-full px-4 py-3 text-left active:bg-gray-50 dark:active:bg-gray-800">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm text-gray-500">{{ kindMark[item.payload.kind] }}</div>
          <div class="min-w-0 flex-1">
            <p class="font-medium truncate text-sm dark:text-gray-100">{{ item.payload.title || kindLabel[item.payload.kind] }}</p>
            <p class="text-xs text-gray-400 truncate">{{ buildMeta(item.payload, item.entry.updatedAt) }}</p>
          </div>
          <span class="text-gray-300 dark:text-gray-600" aria-hidden="true"><AppIcon name="chevron-right" :size="16" /></span>
        </div>
      </button>
      <div v-if="!store.loading && !filtered.length" class="p-8 text-center text-sm text-gray-400 dark:text-gray-500">
        {{ searchQuery ? '没有匹配的秘密' : '暂无秘密。API Key、团队账号、恢复码等都可以安全保存在这里。' }}
      </div>
    </div>

    <Transition name="slide-up">
      <div v-if="showForm" class="fixed inset-0 z-50 bg-white dark:bg-gray-900 flex flex-col" role="dialog" aria-modal="true" aria-labelledby="secret-form-title" style="padding-top: env(safe-area-inset-top); padding-bottom: env(safe-area-inset-bottom, 0px)">
        <header class="px-4 border-b dark:border-gray-700 flex items-center gap-2 min-h-[52px]">
          <button @click="requestClose" class="text-blue-500">取消</button>
          <h2 id="secret-form-title" class="flex-1 text-center font-medium dark:text-gray-100">{{ editingId ? '编辑秘密' : '新建秘密' }}</h2>
          <button @click="save" :disabled="saving || !canSave" class="text-blue-500 font-medium disabled:opacity-40">{{ saving ? '保存中' : '保存' }}</button>
        </header>
        <main class="flex-1 overflow-y-auto px-4 py-4 space-y-4">
          <label class="field-group"><span>类型</span><select v-model="form.kind" class="input"><option v-for="kind in kinds" :key="kind" :value="kind">{{ kindLabel[kind] }}</option></select></label>
          <label class="field-group"><span>标题</span><input ref="titleInput" v-model="form.title" maxlength="120" placeholder="例如：生产环境 API" class="input" /></label>
          <label v-if="form.kind === 'credential'" class="field-group"><span>账号</span><input v-model="form.username" autocomplete="off" placeholder="用户名、邮箱或账号" class="input" /></label>
          <div class="field-group">
            <div class="flex items-center justify-between"><span>秘密内容</span><button @click="showContent = !showContent" class="text-xs text-blue-500 px-2">{{ showContent ? '隐藏' : '显示' }}</button></div>
            <textarea v-model="form.content" :class="['input min-h-[160px] resize-y font-mono', !showContent && 'secret-masked']" autocomplete="off" spellcheck="false" :placeholder="contentPlaceholder" />
            <button v-if="form.content" @click="copyValue(form.content, '秘密内容')" class="w-full border dark:border-gray-600 dark:text-gray-200 rounded-xl text-sm">复制秘密内容</button>
          </div>
          <label class="field-group"><span>文件夹</span><input v-model="form.folder" maxlength="80" placeholder="可选，例如：工作 / 个人" class="input" /></label>
          <label class="field-group"><span>标签</span><input v-model="tagText" placeholder="多个标签用逗号分隔" class="input" /></label>
          <label class="field-group"><span>备注</span><textarea v-model="form.description" rows="3" placeholder="可选，不会显示在列表中" class="input resize-y" /></label>
          <p class="text-xs text-gray-400 leading-relaxed">标题、内容、账号、标签、文件夹和备注会作为一个整体加密后保存与同步。</p>
          <button v-if="editingId" @click="remove" class="w-full border border-red-300 dark:border-red-700 text-red-500 rounded-xl text-sm">删除秘密</button>
        </main>
      </div>
    </Transition>
    <ConfirmDialog :visible="confirmVisible" :title="confirmOpts.title" :message="confirmOpts.message" :confirm-text="confirmOpts.confirmText" :cancel-text="confirmOpts.cancelText" :danger="confirmOpts.danger" @confirm="onConfirm" @cancel="onCancel" />
    <Toast :visible="toast.visible.value" :message="toast.message.value" :type="toast.type.value" />
  </div>
</template>

<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue';
import { Clipboard } from '@capacitor/clipboard';
import { createSecretPayload, parseSecretPayload, serializeSecretPayload, type Entry, type SecretKind, type SecretPayload } from '@flowerkey/core';
import { useEntriesStore } from '../stores/entries';
import { useConfirm } from '../../../ui/src/composables/useConfirm';
import { useToast } from '../../../ui/src/composables/useToast';
import ConfirmDialog from '../../../ui/src/components/ConfirmDialog.vue';
import Toast from '../../../ui/src/components/Toast.vue';
import AppIcon from '../../../ui/src/icons/AppIcon.vue';

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
  const q = searchQuery.value.trim().toLocaleLowerCase('zh-CN');
  if (!q) return items.value;
  return items.value.filter(({ payload }) => [payload.title, payload.folder, payload.username, ...payload.tags].some(value => value.toLocaleLowerCase('zh-CN').includes(q)));
});
const canSave = computed(() => !!form.value.content.trim());
const contentPlaceholder = computed(() => form.value.kind === 'credential' ? '密码' : form.value.kind === 'token' ? 'Token 或 API Key' : form.value.kind === 'key' ? '私钥或密钥内容' : form.value.kind === 'recovery' ? '恢复码或恢复短语' : '需要保密的内容');

onMounted(() => store.load('secret'));
onUnmounted(() => clearTimeout(clipboardTimer));
watch(showForm, value => emit('editing-change', value));

function normalizeForm(): SecretPayload {
  return createSecretPayload({ ...form.value, tags: tagText.value.split(/[,，]/).map(tag => tag.trim()).filter(Boolean) });
}
function buildMeta(payload: SecretPayload, updatedAt: number) {
  const scope = [payload.folder, ...payload.tags].filter(Boolean).join(' · ');
  return `${kindLabel[payload.kind]}${scope ? ` · ${scope}` : ''} · ${new Date(updatedAt).toLocaleDateString('zh-CN')}`;
}
async function focusTitle() { await nextTick(); titleInput.value?.focus(); }
function openNew() {
  editingId.value = ''; form.value = createSecretPayload(); tagText.value = ''; showContent.value = true;
  initialSerialized = serializeSecretPayload(normalizeForm()); showForm.value = true; void focusTitle();
}
function openEdit(entry: Entry, payload: SecretPayload) {
  editingId.value = entry.id; form.value = createSecretPayload(payload); tagText.value = payload.tags.join(', '); showContent.value = false;
  initialSerialized = serializeSecretPayload(normalizeForm()); showForm.value = true;
}
async function requestClose() {
  const dirty = serializeSecretPayload(normalizeForm()) !== initialSerialized;
  if (dirty && !await ask('当前秘密尚未保存，确定放弃吗？', { title: '放弃修改？', danger: true, confirmText: '放弃' })) return;
  showForm.value = false;
}
async function save() {
  if (!canSave.value || saving.value) return;
  saving.value = true;
  const payload = normalizeForm();
  const data = { type: 'secret' as const, content: serializeSecretPayload(payload), title: '', description: '', tags: [], folder: '' };
  try {
    if (editingId.value) await store.update(editingId.value, data);
    else await store.create(data);
    showForm.value = false; toast.show('秘密已加密保存', 'success');
  } catch { toast.show('保存失败，请重试', 'error'); }
  finally { saving.value = false; }
}
async function remove() {
  if (!await ask('删除后会通过同步传播到其他设备，且无法恢复。', { title: '删除秘密？', danger: true, confirmText: '删除' })) return;
  await store.remove(editingId.value); showForm.value = false; toast.show('秘密已删除', 'success');
}
async function copyValue(value: string, label: string) {
  await Clipboard.write({ string: value });
  clearTimeout(clipboardTimer);
  clipboardTimer = setTimeout(async () => {
    try {
      const current = await Clipboard.read();
      if (current.value === value) await Clipboard.write({ string: '' });
    } catch { /* 系统拒绝读取剪贴板时不覆盖用户当前内容 */ }
  }, 60000);
  if (editingId.value) await store.touchLastUsed(editingId.value);
  toast.show(`${label}已复制，60秒后清除`, 'success');
}
</script>

<style scoped>
.field-group { display: grid; gap: 6px; font-size: 12px; color: #6b7280; }
.secret-masked { -webkit-text-security: disc; text-security: disc; }
</style>
