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
