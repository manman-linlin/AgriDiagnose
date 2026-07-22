/** 统一页面标题区 — 图标 + 标题 + 描述 + 右侧可选操作位（通过默认 slot 传入） */
import AppIcon from './AppIcon.js';

export default {
  name: 'PageHeader',
  components: { AppIcon },
  props: {
    icon:        { type: String, default: '' },
    title:       { type: String, required: true },
    description: { type: String, default: '' },
  },
  template: `
    <div class="page-header">
      <div class="page-header-main">
        <div v-if="icon" class="page-header-icon"><app-icon :name="icon" :size="22"></app-icon></div>
        <div class="page-header-text">
          <h1 class="page-header-title">{{ title }}</h1>
          <p v-if="description" class="page-header-desc">{{ description }}</p>
        </div>
      </div>
      <div class="page-header-actions"><slot></slot></div>
    </div>
  `,
};
