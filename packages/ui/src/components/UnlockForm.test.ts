/**
 * 花钥 FlowerKey - 解锁表单组件测试
 * 覆盖正式模式复制时的落库失败退化行为。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';
import { nextTick } from 'vue';

const mainStoreMock = vi.hoisted(() => ({
  runDirectPassword: vi.fn(),
  savePassword: vi.fn(),
}));

vi.mock('../stores/main', () => ({
  useMainStore: () => mainStoreMock,
}));

describe('UnlockForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mainStoreMock.runDirectPassword.mockResolvedValue({ ok: true, password: 'Abc12345!' });
    mainStoreMock.savePassword.mockRejectedValue(new Error('save failed'));
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  it('offers only the frozen FK-DP1 password lengths', async () => {
    const UnlockForm = (await import('./UnlockForm.vue')).default;
    const wrapper = mount(UnlockForm);
    const lengthOptions = wrapper.findAll('option')
      .map(option => option.text())
      .filter(text => text.includes('位'));

    expect(lengthOptions).toEqual(['8位（旧系统）', '16位（默认）', '32位']);
    expect(wrapper.text()).toContain('区分代号中的英文字母不区分大小写');
  });

  it('still copies the generated password when saving the temporary entry fails', async () => {
    const UnlockForm = (await import('./UnlockForm.vue')).default;
    const wrapper = mount(UnlockForm);

    const inputs = wrapper.findAll('input');
    await inputs[0].setValue('master-password');
    await inputs[1].setValue('github-main');
    await vi.advanceTimersByTimeAsync(450);
    await nextTick();

    const copyButton = wrapper.findAll('button').find((button) => button.text() === '复制');
    expect(copyButton).toBeTruthy();
    await copyButton!.trigger('click');

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Abc12345!');
  });
});
