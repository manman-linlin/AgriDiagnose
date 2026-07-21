/** 统一错误态组件 — 优化版：fade+scale 入场 */
window.makeAppError = function () {
  return {
    props: {
      message:   { type: String, default: '出错了' },
      retryable: { type: Boolean, default: false },
    },
    emits: ['retry'],
    template: `
      <div class="card error-alert" style="margin-bottom:0;animation: fadeScaleIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);">
        <strong>⚠️</strong>
        <span style="flex:1;">{{ message }}</span>
        <button v-if="retryable" class="btn btn-sm btn-outline" @click="$emit('retry')">🔄 重试</button>
      </div>
    `,
  };
};
