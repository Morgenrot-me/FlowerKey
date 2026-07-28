<!--
  花钥移动端 - 首次初始化页
  初始化只设置一次主密码与身份密语；页面内容可滚动，操作区避开系统安全区。
-->
<template>
  <div class="setup-page">
    <main class="setup-page__scroll">
      <div class="setup-page__content">
        <header class="text-center space-y-1">
          <h1 class="text-2xl font-bold text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2"><img src="../assets/key.png" class="w-10 h-10 object-contain" /> 花钥</h1>
          <p class="text-sm text-gray-600 dark:text-gray-300">首次初始化</p>
          <p class="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">以后只需记住主密码、身份密语，以及每个平台的区分代号。</p>
        </header>

        <section class="setup-section">
          <h2>主密码</h2>
          <p class="section-note">主密码会频繁使用，决定所有生成密码；完成初始化后不能修改。</p>
          <input v-model="pwd" type="password" placeholder="输入主密码（至少4位）" autocomplete="new-password" class="field" />
          <PasswordStrength :password="pwd" />
          <input v-model="pwd2" type="password" placeholder="再次输入主密码" autocomplete="new-password" class="field" />
        </section>

        <section class="setup-section">
          <h2>身份密语</h2>
          <p class="section-note emphasis">只在这次初始化时输入一次，之后花钥会在本机加密保存。</p>
          <p class="section-note">请写一条多年后仍能完整记住的私人句子。允许中文；保留大小写、空格和标点，不要求数字、符号。</p>
          <input v-model="salt" type="password" placeholder="输入私人身份密语" autocomplete="new-password" class="field" />
          <input v-model="salt2" type="password" placeholder="再次完整输入身份密语" autocomplete="new-password" class="field" />
          <input v-model="identityHint" type="text" placeholder="身份密语提示（可选，不要写出密语）" class="field" maxlength="120" />
          <p class="helper">提示只保存在本机，帮助你区分这条密语；不参与密码生成，也不能恢复密语。</p>
        </section>

        <p class="codename-note"><strong>区分代号</strong> 是以后按平台填写的名称，例如“微信”“支付宝”“QQ”“GitHub”，不是身份密语。ASCII 英文字母不区分大小写。</p>
        <p v-if="err" class="text-red-500 dark:text-red-400 text-sm text-center">{{ err }}</p>
      </div>
    </main>
    <footer class="setup-page__footer">
      <button @click="submit" :disabled="loading" class="submit-button">{{ loading ? '设置中...' : '开始使用' }}</button>
    </footer>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useMainStore } from '../stores/main';
import PasswordStrength from '../../../ui/src/components/PasswordStrength.vue';
const main = useMainStore();
const pwd = ref(''), pwd2 = ref(''), salt = ref(''), salt2 = ref(''), identityHint = ref(''), err = ref(''), loading = ref(false);
const emit = defineEmits<{ done: [] }>();
async function submit() {
  err.value = '';
  if (pwd.value.length < 4) { err.value = '密码至少4位'; return; }
  if (pwd.value !== pwd2.value) { err.value = '两次密码不一致'; return; }
  if (!salt.value.trim()) { err.value = '请输入身份密语'; return; }
  if (salt.value !== salt.value.trim()) { err.value = '身份密语首尾不能包含空白'; return; }
  if (salt.value !== salt2.value) { err.value = '两次身份密语不一致'; return; }
  if (identityHint.value.trim() && identityHint.value.normalize('NFC') === salt.value.normalize('NFC')) { err.value = '提示不能直接写出身份密语'; return; }
  loading.value = true;
  try { await main.setup(pwd.value, salt.value, identityHint.value.trim()); emit('done'); }
  catch (e) { err.value = e instanceof Error ? e.message : '初始化失败'; loading.value = false; }
}
</script>

<style scoped>
.setup-page { height: 100%; min-height: 0; display: flex; flex-direction: column; color: #111827; }
.setup-page__scroll { min-height: 0; flex: 1; overflow-y: auto; padding: 20px 24px; }
.setup-page__content { max-width: 520px; margin: 0 auto; display: grid; gap: 18px; }
.setup-section { display: grid; gap: 9px; }
.setup-section h2 { font-size: 15px; font-weight: 600; }
.section-note, .helper, .codename-note { font-size: 12px; line-height: 1.6; color: #6b7280; }
.emphasis { color: #b45309; font-weight: 600; }
.field { width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1px solid #d1d5db; border-radius: 10px; font-size: 16px; outline: none; background: white; }
.field:focus { border-color: #60a5fa; }
.codename-note { padding-top: 2px; }
.setup-page__footer { flex: none; padding: 12px 24px calc(12px + env(safe-area-inset-bottom, 0px)); border-top: 1px solid #e5e7eb; background: inherit; }
.submit-button { width: 100%; padding: 12px; border: 0; border-radius: 10px; background: #3b82f6; color: white; font-weight: 600; font-size: 15px; }
.submit-button:disabled { opacity: .5; }
:global(.dark) .setup-page { color: #f3f4f6; }
:global(.dark) .section-note, :global(.dark) .helper, :global(.dark) .codename-note { color: #9ca3af; }
:global(.dark) .field { background: #1f2937; border-color: #4b5563; color: #f3f4f6; }
:global(.dark) .setup-page__footer { border-color: #374151; }
@media (max-height: 700px) { .setup-page__scroll { padding-top: 12px; } .setup-page__content { gap: 14px; } }
</style>
