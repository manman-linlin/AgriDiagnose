/** 诊断结果卡片 — 置信度数字递增、Top-3 staggered 入场、操作按钮浮起 */
import { computed } from 'vue';
import { useCountUp } from '../../../shared/composables/useCountUp.js';
import AppConfBar from '../../../shared/components/AppConfBar.js';
import AppTop3List from '../../../shared/components/AppTop3List.js';
import AppIcon from '../../../shared/components/AppIcon.js';

export default {
  name: 'ResultCard',
  components: { AppConfBar, AppTop3List, AppIcon },
  props: {
    result: { type: Object, default: null },
  },
  emits: ['chat', 'contribute', 'encyclopedia', 'reset'],
  setup(props) {
    const target = computed(() => props.result?.top1?.confidence ?? 0);
    const { display: displayConfidence } = useCountUp(target, { duration: 800 });

    const confClass = computed(() => {
      const v = props.result?.top1?.confidence || 0;
      if (v >= 90) return 'high';
      if (v >= 60) return 'mid';
      return 'low';
    });
    const confLabel = computed(() => {
      const v = props.result?.top1?.confidence || 0;
      if (v >= 90) return '高置信度';
      if (v >= 60) return '中置信度 — 建议人工复核';
      return '低置信度 — 建议重新拍照';
    });
    const confIcon = computed(() => {
      const v = props.result?.top1?.confidence || 0;
      if (v >= 90) return 'check-circle';
      if (v >= 60) return 'alert-triangle';
      return 'x-circle';
    });

    return { displayConfidence, confClass, confLabel, confIcon };
  },
  template: `
    <div class="card" v-if="result">
      <div class="card-header"><app-icon name="clipboard"></app-icon> 诊断结果</div>

      <!-- 主结果 -->
      <div class="result-hero">
        <div class="result-info">
          <div class="result-crop">{{ result.top1.crop }} · {{ result.top1.disease }}</div>
          <div class="result-label">{{ result.top1.label_cn }}</div>
          <span class="conf-tag" :class="confClass" style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;">
            <app-icon :name="confIcon" :size="13"></app-icon>{{ confLabel }}
          </span>
        </div>
        <div class="result-score">
          <div class="result-score-num" :class="{ counting: displayConfidence !== result.top1.confidence }">
            {{ displayConfidence }}%
          </div>
          <div class="result-score-hint">置信度</div>
        </div>
      </div>

      <!-- 置信度进度条 -->
      <app-conf-bar :value="result.top1.confidence"></app-conf-bar>

      <!-- Top-3 -->
      <app-top3-list :items="result.top3"></app-top3-list>

      <!-- 操作入口 — 浮起效果 -->
      <div style="margin-top:18px;">
        <div style="font-size:14px;font-weight:600;margin-bottom:10px;color:#555;">下一步操作</div>
        <div class="action-cards">
          <div class="action-card stagger-item" :style="{ '--i': 0 }" @click="$emit('chat')">
            <div class="action-icon"><app-icon name="bot" :size="26"></app-icon></div>
            <div class="action-title">AI 深度解读</div>
            <div class="action-desc">让 AI 分析图片并生成防治方案</div>
          </div>
          <div class="action-card stagger-item" :style="{ '--i': 1 }" @click="$emit('contribute')">
            <div class="action-icon"><app-icon name="upload" :size="26"></app-icon></div>
            <div class="action-title">贡献此样本</div>
            <div class="action-desc">补充训练数据，帮助模型改进</div>
          </div>
          <div class="action-card stagger-item" :style="{ '--i': 2 }" @click="$emit('encyclopedia')">
            <div class="action-icon"><app-icon name="book-open" :size="26"></app-icon></div>
            <div class="action-title">查看病害百科</div>
            <div class="action-desc">了解详情与防治知识</div>
          </div>
        </div>
      </div>

      <!-- 重新诊断 -->
      <button class="btn btn-secondary btn-block" style="margin-top:14px;" @click="$emit('reset')">
        <app-icon name="refresh-cw" :size="14"></app-icon> 重新诊断
      </button>
    </div>
  `,
};
