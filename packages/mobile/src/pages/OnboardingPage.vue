<!--
  花钥移动端 - 引导页
  首次使用前展示，介绍花钥核心理念
-->
<template>
  <div class="h-full flex flex-col items-center justify-between px-6 py-12">
    <div class="flex-1 flex flex-col items-center justify-center gap-10 w-full max-w-sm">

      <div class="flex flex-col items-center gap-2">
        <h1 class="text-2xl font-bold text-center text-blue-600 dark:text-blue-400 flex items-center justify-center gap-2">
          <img src="../assets/key.png" class="w-10 h-10 object-contain" /> 花钥
        </h1>
        <p class="text-sm text-gray-600 dark:text-gray-300 text-center font-medium">欢迎使用花钥</p>
      </div>

      <div class="flex flex-col gap-5 w-full">
        <div class="flex gap-3 items-start">
          <span class="text-xl shrink-0 mt-0.5">🧠</span>
          <div>
            <p class="text-sm font-medium dark:text-gray-100">一个密码，管理所有账号</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">记忆密码 + 区分代号，通过算法推算出每个账号的唯一强密码。相同的输入在任何设备都得到相同结果——数据全丢了，密码依然可以重新生成。</p>
          </div>
        </div>
        <div class="flex gap-3 items-start">
          <span class="text-xl shrink-0 mt-0.5">🛡️</span>
          <div>
            <p class="text-sm font-medium dark:text-gray-100">没有密码库，就没有密码库被盗</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">花钥从不存储你的密码。主流密码管理器的加密密码库是攻击者的目标，花钥没有这个目标——密码只在你需要时生成，用完即弃。</p>
          </div>
        </div>
        <div class="flex gap-3 items-start">
          <span class="text-xl shrink-0 mt-0.5">🔒</span>
          <div>
            <p class="text-sm font-medium dark:text-gray-100">军用级加密，完全离线</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 mt-1 leading-relaxed">区分代号等信息经 AES-256-GCM 加密存储于本地。记忆密码只短暂存在于内存，从不落盘、从不上传任何服务器。</p>
          </div>
        </div>
      </div>
    </div>

    <button @click="$emit('done')" class="w-full max-w-sm py-3.5 bg-blue-500 text-white rounded-2xl text-base font-medium">
      开始使用
    </button>
  </div>
</template>

<script setup lang="ts">
defineEmits<{ done: [] }>();
</script>
