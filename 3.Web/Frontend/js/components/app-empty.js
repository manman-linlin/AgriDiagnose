/** 统一空状态组件 — 优化版：fade+scale 入场 */
window.makeAppEmpty = function () {
  return {
    props: {
      icon:        { type: String, default: '🍂' },
      title:       { type: String, default: '暂无数据' },
      description: { type: String, default: '' },
      actionLabel: { type: String, default: '' },
    },
    emits: ['action'],
    template: `
      <div class="card" style="animation: fadeScaleIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);">
        <div class="empty-state">
          <div class="empty-icon">{{ icon }}</div>
          <div class="empty-title">{{ title }}</div>
          <div v-if="description" class="empty-desc">{{ description }}</div>
          <button
            v-if="actionLabel"
            class="btn btn-primary"
            style="max-width:200px;margin:0 auto;"
            @click="$emit('action')"
          >{{ actionLabel }}</button>
        </div>
      </div>
    `,
  };
};
