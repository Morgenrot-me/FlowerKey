/**
 * 花钥首次设置测试。
 * 身份密语是 FK-DP1 的必需根输入，必须完整确认且不得回退到公开常量。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '@vue/test-utils';

const mainStoreMock = vi.hoisted(() => ({
  setup: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../stores/main', () => ({
  useMainStore: () => mainStoreMock,
}));

describe('SetupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('requires an explicitly confirmed identity secret', async () => {
    const SetupForm = (await import('./SetupForm.vue')).default;
    const wrapper = mount(SetupForm);
    const inputs = wrapper.findAll('input');

    await inputs[0].setValue('master-password');
    await inputs[1].setValue('master-password');
    await wrapper.findAll('button').at(-1)!.trigger('click');

    expect(wrapper.text()).toContain('请输入身份密语');
    expect(mainStoreMock.setup).not.toHaveBeenCalled();
  });

  it('masks both identity secret inputs by default', async () => {
    const SetupForm = (await import('./SetupForm.vue')).default;
    const wrapper = mount(SetupForm);
    const identityInputs = wrapper.findAll('input').slice(2);

    expect(identityInputs).toHaveLength(2);
    expect(identityInputs.every(input => input.attributes('type') === 'password')).toBe(true);
  });

  it('passes internal spaces and case to setup unchanged', async () => {
    const SetupForm = (await import('./SetupForm.vue')).default;
    const wrapper = mount(SetupForm);
    let inputs = wrapper.findAll('input');

    await inputs[0].setValue('master-password');
    await inputs[1].setValue('master-password');
    await inputs[2].setValue('只属于我的 Identity A');
    inputs = wrapper.findAll('input');
    await inputs[3].setValue('只属于我的 Identity A');
    await wrapper.findAll('button').at(-1)!.trigger('click');

    expect(mainStoreMock.setup).toHaveBeenCalledWith(
      'master-password',
      '只属于我的 Identity A',
    );
  });

  it('rejects leading or trailing whitespace instead of silently trimming it', async () => {
    const SetupForm = (await import('./SetupForm.vue')).default;
    const wrapper = mount(SetupForm);
    const inputs = wrapper.findAll('input');

    await inputs[0].setValue('master-password');
    await inputs[1].setValue('master-password');
    await inputs[2].setValue(' 身份密语');
    await inputs[3].setValue(' 身份密语');
    await wrapper.findAll('button').at(-1)!.trigger('click');

    expect(wrapper.text()).toContain('身份密语首尾不能包含空白');
    expect(mainStoreMock.setup).not.toHaveBeenCalled();
  });
});
