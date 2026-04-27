/**
 * 花钥 FlowerKey - 密码强度组件测试
 * 覆盖不同密码复杂度下的文案和颜色反馈
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import PasswordStrength from './PasswordStrength.vue';

describe('PasswordStrength', () => {
  it('does not render strength details for empty passwords', () => {
    const wrapper = mount(PasswordStrength, { props: { password: '' } });

    expect(wrapper.text()).toBe('');
    expect(wrapper.find('.h-1').exists()).toBe(false);
  });

  it('shows weak feedback for short passwords', () => {
    const wrapper = mount(PasswordStrength, { props: { password: 'abc' } });

    expect(wrapper.text()).toContain('弱');
    expect(wrapper.find('.bg-red-500').exists()).toBe(true);
  });

  it('shows medium feedback for moderately complex passwords', () => {
    const wrapper = mount(PasswordStrength, { props: { password: 'abc12345' } });

    expect(wrapper.text()).toContain('较强');
    expect(wrapper.find('.bg-yellow-500').exists()).toBe(true);
  });

  it('shows strong feedback for long mixed passwords', () => {
    const wrapper = mount(PasswordStrength, { props: { password: 'Abc12345!xyz' } });

    expect(wrapper.text()).toContain('强');
    expect(wrapper.find('.bg-green-500').exists()).toBe(true);
  });
});
