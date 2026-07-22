/** 统一加载态组件 — fade+scale 入场 */
import { computed } from 'vue';

export default {
  name: 'AppLoading',
  props: {
    text:   { type: String, default: '加载中...' },
    size:   { type: String, default: 'md' },       // sm | md | lg
    inline: { type: Boolean, default: false },      // true = 内联模式（不带卡片壳）
  },
  setup(props) {
    const spinnerStyle = computed(() => {
      const map = { sm: '20px', md: '36px', lg: '48px' };
      const s = map[props.size] || map.md;
      return { width: s, height: s };
    });
    return { spinnerStyle };
  },
  template: `
    <div v-if="!inline" class="card fade-scale-enter-active" style="animation: fadeScaleIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);">
      <div class="loading-wrap">
        <div class="spinner" :style="spinnerStyle"></div>
        <div>{{ text }}</div>
      </div>
    </div>
    <div v-else class="loading-wrap" style="padding:16px 0;">
      <div class="spinner" :style="spinnerStyle"></div>
      <div style="font-size:13px;color:#999;">{{ text }}</div>
    </div>
  `,
};
