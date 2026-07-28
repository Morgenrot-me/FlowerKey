/**
 * 花钥 FlowerKey - 条目表单组件测试
 * 覆盖保存时对 folder 字段的保留与密码模式切换字段清理行为。
 */
import { describe, expect, it } from 'vitest';
import { mount } from '@vue/test-utils';
import { createPinia } from 'pinia';
import EntryForm from './EntryForm.vue';

const pinia = createPinia();

describe('EntryForm', () => {
  it('shows only frozen FK-DP1 lengths and explains codename case handling', () => {
    const wrapper = mount(EntryForm, {
      global: { plugins: [pinia] },
      props: {
        type: 'password',
        tags: [],
        folders: [],
      },
    });

    const lengthOptions = wrapper.findAll('option')
      .map(option => option.text())
      .filter(text => text.includes('位'));

    expect(lengthOptions).toEqual(['8位（旧系统）', '16位（默认）', '32位']);
    expect(wrapper.text()).toContain('区分代号中的英文字母不区分大小写');
  });

  it('emits the current folder when saving an existing entry', async () => {
    const wrapper = mount(EntryForm, {
      global: { plugins: [pinia] },
      props: {
        type: 'bookmark',
        tags: [],
        folders: ['工作'],
        entry: {
          id: 'entry-1',
          type: 'bookmark',
          title: 'GitHub',
          url: 'https://github.com',
          folder: '工作',
          tags: [],
          description: '',
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });

    const buttons = wrapper.findAll('button');
    await buttons[1].trigger('click');

    const payload = wrapper.emitted('save')?.[0]?.[0];
    expect(payload?.folder).toBe('工作');
  });

  it('clears stored password when an existing password entry is switched to generate mode', async () => {
    const wrapper = mount(EntryForm, {
      global: { plugins: [pinia] },
      props: {
        type: 'password',
        tags: [],
        folders: [],
        entry: {
          id: 'entry-1',
          type: 'password',
          codename: 'github',
          storedPassword: 'old-secret',
          folder: '',
          tags: [],
          description: '',
          createdAt: 1,
          updatedAt: 1,
        },
      },
    });

    const buttons = wrapper.findAll('button');
    await buttons.find(button => button.text() === '生成模式')?.trigger('click');
    await buttons.find(button => button.text() === '保存')?.trigger('click');

    const payload = wrapper.emitted('save')?.[0]?.[0];
    expect(payload?.storedPassword).toBeUndefined();
    expect(Object.prototype.hasOwnProperty.call(payload, 'storedPassword')).toBe(true);
  });
});
