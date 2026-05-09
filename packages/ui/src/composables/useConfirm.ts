/**
 * 花钥 - 确认对话框可组合函数
 * 替代原生 confirm()，支持异步调用
 *
 * 用法：
 * const { ask } = useConfirm();
 * const ok = await ask('确定删除？', { title: '删除确认', danger: true });
 */
import { ref } from 'vue';

interface ConfirmOptions {
  title?: string;
  confirmText?: string;
  cancelText?: string;
  danger?: boolean;
}

export function useConfirm() {
  const visible = ref(false);
  const options = ref<ConfirmOptions & { message: string }>({ message: '' });
  let _resolve: ((value: boolean) => void) | null = null;

  function ask(message: string, opts: ConfirmOptions = {}): Promise<boolean> {
    options.value = { message, ...opts };
    visible.value = true;
    return new Promise(resolve => { _resolve = resolve; });
  }

  function onConfirm() {
    visible.value = false;
    _resolve?.(true);
    _resolve = null;
  }

  function onCancel() {
    visible.value = false;
    _resolve?.(false);
    _resolve = null;
  }

  return { visible, options, ask, onConfirm, onCancel };
}
