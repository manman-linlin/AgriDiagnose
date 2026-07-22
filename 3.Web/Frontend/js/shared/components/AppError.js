/** 统一错误态组件 — fade+scale 入场 */
import AppIcon from './AppIcon.js';

export default {
  name: 'AppError',
  components: { AppIcon },
  props: {
    message:   { type: String, default: '出错了' },
    retryable: { type: Boolean, default: false },
  },
  emits: ['retry'],
  template: `
    <div class="card error-alert" style="margin-bottom:0;animation: fadeScaleIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);">
      <strong style="display:flex;"><app-icon name="alert-triangle" :size="18"></app-icon></strong>
      <span style="flex:1;">{{ message }}</span>
      <button v-if="retryable" class="btn btn-sm btn-outline" @click="$emit('retry')">
        <app-icon name="refresh-cw" :size="14"></app-icon> 重试
      </button>
    </div>
  `,
};
