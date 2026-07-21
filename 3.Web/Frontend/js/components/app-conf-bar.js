/** 置信度进度条组件 — 优化版：渐变填充 + 数字标签跟随位置 */
window.makeAppConfBar = function () {
  return {
    props: {
      value: { type: Number, default: 0 },   // 0-100
      showLabel: { type: Boolean, default: true },
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
    computed: {
      barClass() {
        if (this.value >= 90) return 'conf-high';
        if (this.value >= 60) return 'conf-mid';
        return 'conf-low';
      },
    },
  };
};
