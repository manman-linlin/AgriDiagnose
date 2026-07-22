/** 防治方案结构化卡片 — Section 折叠/展开 */
import { reactive, computed } from 'vue';
import AppIcon from '../../../shared/components/AppIcon.js';

export default {
  name: 'AdviceCard',
  components: { AppIcon },
  props: {
    advice: { type: Object, default: null },
  },
  setup(props) {
    const collapsedSections = reactive({});

    function toggleSection(key) {
      collapsedSections[key] = !collapsedSections[key];
    }
    function isCollapsed(key) {
      return !!collapsedSections[key];
    }

    const riskClass = computed(() => {
      const r = (props.advice?.risk_level || '').toLowerCase();
      if (r === '低' || r === 'low') return 'low';
      if (r === '中' || r === 'mid' || r === 'medium') return 'mid';
      if (r === '高' || r === 'high') return 'high';
      if (r === '严重') return 'high';
      return 'mid';
    });

    return { collapsedSections, toggleSection, isCollapsed, riskClass };
  },
  template: `
    <div class="chat-advice-card" v-if="advice">
      <div class="advice-header">
        <span style="display:flex;align-items:center;gap:6px;"><app-icon name="bug" :size="15"></app-icon> {{ advice.disease_name }}</span>
        <span class="tag tag-md" :class="'tag-risk-'+riskClass" style="display:inline-flex;align-items:center;gap:4px;">
          <app-icon name="alert-triangle" :size="11"></app-icon> {{ advice.risk_level || '未知' }}
        </span>
      </div>

      <!-- 典型症状 — 可折叠 -->
      <div v-if="advice.symptoms" class="advice-section">
        <div class="advice-section-title" @click="toggleSection('symptoms')">
          <app-icon name="chevron-down" :size="12" class="collapse-arrow" :class="{ open: !isCollapsed('symptoms') }"></app-icon>
          <app-icon name="stethoscope" :size="14"></app-icon> 典型症状
        </div>
        <div class="advice-section-body" :class="{ collapsed: isCollapsed('symptoms') }">
          <div style="font-size:14px;color:#666;">{{ advice.symptoms }}</div>
        </div>
      </div>

      <!-- 发病原因 — 可折叠 -->
      <div v-if="advice.cause" class="advice-section">
        <div class="advice-section-title" @click="toggleSection('cause')">
          <app-icon name="chevron-down" :size="12" class="collapse-arrow" :class="{ open: !isCollapsed('cause') }"></app-icon>
          <app-icon name="thermometer" :size="14"></app-icon> 发病原因
        </div>
        <div class="advice-section-body" :class="{ collapsed: isCollapsed('cause') }">
          <div style="font-size:14px;color:#666;">{{ advice.cause }}</div>
        </div>
      </div>

      <!-- 预防措施 — 可折叠 -->
      <div v-if="advice.prevention && advice.prevention.length" class="advice-section">
        <div class="advice-section-title" @click="toggleSection('prevention')">
          <app-icon name="chevron-down" :size="12" class="collapse-arrow" :class="{ open: !isCollapsed('prevention') }"></app-icon>
          <app-icon name="shield" :size="14"></app-icon> 预防措施
        </div>
        <div class="advice-section-body" :class="{ collapsed: isCollapsed('prevention') }">
          <div style="font-size:14px;color:#666;">
            <div v-for="(p, i) in advice.prevention" :key="i" style="display:flex;gap:6px;align-items:flex-start;"><app-icon name="check" :size="12" style="margin-top:3px;flex-shrink:0;"></app-icon> {{ p }}</div>
          </div>
        </div>
      </div>

      <!-- 治疗建议 — 可折叠 -->
      <div v-if="advice.treatment && advice.treatment.length" class="advice-section">
        <div class="advice-section-title" @click="toggleSection('treatment')">
          <app-icon name="chevron-down" :size="12" class="collapse-arrow" :class="{ open: !isCollapsed('treatment') }"></app-icon>
          <app-icon name="pill" :size="14"></app-icon> 治疗建议
        </div>
        <div class="advice-section-body" :class="{ collapsed: isCollapsed('treatment') }">
          <div style="font-size:14px;color:#666;">
            <div v-for="(t, i) in advice.treatment" :key="i" style="display:flex;gap:6px;align-items:flex-start;"><app-icon name="check" :size="12" style="margin-top:3px;flex-shrink:0;"></app-icon> {{ t }}</div>
          </div>
        </div>
      </div>

      <div v-if="advice.manual_check_required" style="margin-top:10px;font-size:12px;color:var(--color-accent);display:flex;align-items:center;gap:6px;">
        <app-icon name="alert-triangle" :size="13"></app-icon> 建议在专业农技人员指导下用药，注意农药安全间隔期
      </div>
    </div>
  `,
};
