/** 防治方案结构化卡片 — 优化版：Section 折叠/展开 + 风险标签脉冲 */
window.makeAppAdviceCard = function () {
  return {
    props: {
      advice: { type: Object, default: null },
    },
    data() {
      return {
        collapsedSections: {},
      };
    },
    methods: {
      toggleSection(key) {
        this.collapsedSections = {
          ...this.collapsedSections,
          [key]: !this.collapsedSections[key],
        };
      },
      isCollapsed(key) {
        return !!this.collapsedSections[key];
      },
    },
    template: `
      <div class="chat-advice-card" v-if="advice">
        <div class="advice-header">
          <span>🦠 {{ advice.disease_name }}</span>
          <span class="tag tag-md" :class="'tag-risk-'+riskClass">
            ⚠️ {{ advice.risk_level || '未知' }}
          </span>
        </div>

        <!-- 典型症状 — 可折叠 -->
        <div v-if="advice.symptoms" class="advice-section">
          <div class="advice-section-title" @click="toggleSection('symptoms')">
            <span class="collapse-arrow" :class="{ open: !isCollapsed('symptoms') }">▶</span>
            🩺 典型症状
          </div>
          <div class="advice-section-body" :class="{ collapsed: isCollapsed('symptoms') }">
            <div style="font-size:14px;color:#666;">{{ advice.symptoms }}</div>
          </div>
        </div>

        <!-- 发病原因 — 可折叠 -->
        <div v-if="advice.cause" class="advice-section">
          <div class="advice-section-title" @click="toggleSection('cause')">
            <span class="collapse-arrow" :class="{ open: !isCollapsed('cause') }">▶</span>
            🌡️ 发病原因
          </div>
          <div class="advice-section-body" :class="{ collapsed: isCollapsed('cause') }">
            <div style="font-size:14px;color:#666;">{{ advice.cause }}</div>
          </div>
        </div>

        <!-- 预防措施 — 可折叠 -->
        <div v-if="advice.prevention && advice.prevention.length" class="advice-section">
          <div class="advice-section-title" @click="toggleSection('prevention')">
            <span class="collapse-arrow" :class="{ open: !isCollapsed('prevention') }">▶</span>
            🛡️ 预防措施
          </div>
          <div class="advice-section-body" :class="{ collapsed: isCollapsed('prevention') }">
            <div style="font-size:14px;color:#666;">
              <div v-for="(p, i) in advice.prevention" :key="i">✓ {{ p }}</div>
            </div>
          </div>
        </div>

        <!-- 治疗建议 — 可折叠 -->
        <div v-if="advice.treatment && advice.treatment.length" class="advice-section">
          <div class="advice-section-title" @click="toggleSection('treatment')">
            <span class="collapse-arrow" :class="{ open: !isCollapsed('treatment') }">▶</span>
            💊 治疗建议
          </div>
          <div class="advice-section-body" :class="{ collapsed: isCollapsed('treatment') }">
            <div style="font-size:14px;color:#666;">
              <div v-for="(t, i) in advice.treatment" :key="i">✓ {{ t }}</div>
            </div>
          </div>
        </div>

        <div v-if="advice.manual_check_required" style="margin-top:10px;font-size:12px;color:var(--color-accent);">
          ⚠️ 建议在专业农技人员指导下用药，注意农药安全间隔期
        </div>
      </div>
    `,
    computed: {
      riskClass() {
        const r = (this.advice?.risk_level || '').toLowerCase();
        if (r === '低' || r === 'low') return 'low';
        if (r === '中' || r === 'mid'|| r === 'medium') return 'mid';
        if (r === '高' || r === 'high') return 'high';
        if (r === '严重') return 'high';
        return 'mid';
      },
    },
  };
};
