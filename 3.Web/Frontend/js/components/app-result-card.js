/** 诊断结果卡片 — 优化版：置信度数字递增、Top-3 staggered 入场、操作按钮浮起 */
window.makeAppResultCard = function () {
  return {
    props: {
      result: { type: Object, default: null },
    },
    emits: ['chat', 'contribute', 'encyclopedia', 'reset'],
    data() {
      return {
        displayConfidence: 0,
        animTimer: null,
      };
    },
    watch: {
      result: {
        handler(newVal) {
          if (newVal && newVal.top1) {
            this.animateConfidence(newVal.top1.confidence);
          }
        },
        immediate: true,
      },
    },
    methods: {
      animateConfidence(target) {
        if (this.animTimer) clearInterval(this.animTimer);
        const start = this.displayConfidence;
        const duration = 800; // ms
        const startTime = performance.now();

        const step = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          // ease-out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          this.displayConfidence = Math.round(start + (target - start) * eased);

          if (progress < 1) {
            this.animTimer = requestAnimationFrame(step);
          } else {
            this.displayConfidence = target;
          }
        };
        this.animTimer = requestAnimationFrame(step);
      },
    },
    beforeUnmount() {
      if (this.animTimer) cancelAnimationFrame(this.animTimer);
    },
    template: `
      <div class="card" v-if="result">
        <div class="card-header">📋 诊断结果</div>

        <!-- 主结果 -->
        <div class="result-hero">
          <div class="result-info">
            <div class="result-crop">{{ result.top1.crop }} · {{ result.top1.disease }}</div>
            <div class="result-label">{{ result.top1.label_cn }}</div>
            <span class="conf-tag mt-sm" :class="confClass" style="margin-top:6px;">
              {{ confLabel }}
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
              <div class="action-icon">🤖</div>
              <div class="action-title">AI 深度解读</div>
              <div class="action-desc">让 AI 分析图片并生成防治方案</div>
            </div>
            <div class="action-card stagger-item" :style="{ '--i': 1 }" @click="$emit('contribute')">
              <div class="action-icon">📤</div>
              <div class="action-title">贡献此样本</div>
              <div class="action-desc">补充训练数据，帮助模型改进</div>
            </div>
            <div class="action-card stagger-item" :style="{ '--i': 2 }" @click="$emit('encyclopedia')">
              <div class="action-icon">📖</div>
              <div class="action-title">查看病害百科</div>
              <div class="action-desc">了解详情与防治知识</div>
            </div>
          </div>
        </div>

        <!-- 重新诊断 -->
        <button class="btn btn-secondary btn-block" style="margin-top:14px;" @click="$emit('reset')">
          🔄 重新诊断
        </button>
      </div>
    `,
    computed: {
      confClass() {
        const v = this.result?.top1?.confidence || 0;
        if (v >= 90) return 'high';
        if (v >= 60) return 'mid';
        return 'low';
      },
      confLabel() {
        const v = this.result?.top1?.confidence || 0;
        if (v >= 90) return '✅ 高置信度';
        if (v >= 60) return '⚠️ 中置信度 — 建议人工复核';
        return '❌ 低置信度 — 建议重新拍照';
      },
    },
  };
};
