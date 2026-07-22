/** 置信度进度条组件 — 渐变填充 + 数字标签跟随位置 */
import { computed } from 'vue';

export default {
  name: 'AppConfBar',
  props: {
    value:     { type: Number, default: 0 },   // 0-100
    showLabel: { type: Boolean, default: true },
  },
  setup(props) {
    const barClass = computed(() => {
      if (props.value >= 90) return 'conf-high';
      if (props.value >= 60) return 'conf-mid';
      return 'conf-low';
    });
    return { barClass };
  },
  template: `
    <div>
      <div class="conf-bar">
        <div
          class="conf-bar-fill"
          :class="barClass"
          :style="{ width: value + '%' }"
        ></div>
      </div>
      <div v-if="showLabel" class="conf-bar-label" :style="{ paddingRight: (100 - value) + '%' }">
        {{ value }}%
      </div>
    </div>
  `,
};
