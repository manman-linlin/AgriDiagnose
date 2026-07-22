/** Top-3 预测结果列表 — 排名徽章弹出动画、行 hover 背景渐入 */
export default {
  name: 'AppTop3List',
  props: {
    items: { type: Array, default: () => [] },
  },
  template: `
    <div class="top3-list" v-if="items.length">
      <div class="top3-title">Top-{{ items.length }} 预测结果</div>
      <div
        v-for="(item, idx) in items"
        :key="idx"
        class="top3-row stagger-item"
        :class="{ best: idx === 0 }"
        :style="{ '--i': idx, animationDelay: (0.1 * idx) + 's' }"
      >
        <div class="top3-rank" :class="'rank-' + (idx + 1)">{{ idx + 1 }}</div>
        <div class="top3-name">
          {{ item.label_cn }}
          <small>{{ item.crop }} · {{ item.disease }}</small>
        </div>
        <div class="top3-pct">{{ item.confidence }}%</div>
      </div>
    </div>
  `,
};
