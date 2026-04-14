/**
 * 花钥 - Toast 可组合函数
 * 提供全局轻量级操作反馈
 *
 * 用法：
 * const toast = useToast();
 * toast.show('已复制密码', 'success');
 * toast.show('操作失败', 'error');
 */
import { ref } from 'vue';

export function useToast(duration = 2000) {
  const visible = ref(false);
  const message = ref('');
  const type = ref<'success' | 'error' | 'info'>('info');
  let timer: ReturnType<typeof setTimeout> | null = null;

  function show(msg: string, t: 'success' | 'error' | 'info' = 'info') {
    if (timer) clearTimeout(timer);
    message.value = msg;
    type.value = t;
    visible.value = true;
    timer = setTimeout(() => { visible.value = false; timer = null; }, duration);
  }

  return { visible, message, type, show };
}
