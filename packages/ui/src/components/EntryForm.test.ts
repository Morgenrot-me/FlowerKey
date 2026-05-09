/**
 * 花钥 FlowerKey - 条目表单组件测试
 * 覆盖保存时对 folder 字段的保留与提交行为。
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
});
