/** 侧边栏导航组件 — Grid 布局适配版 */
import { computed } from 'vue';
import AppIcon from '../shared/components/AppIcon.js';

export default {
  name: 'AppSidebar',
  components: { AppIcon },
  props: {
    currentPage: { type: String, default: 'diagnose' },
    pages:       { type: Object, default: () => ({}) },
    modelReady:  { type: Boolean, default: false },
    open:        { type: Boolean, default: false },   // 手机端由父组件控制
  },
  emits: ['navigate'],
  setup(props, { emit }) {
    function go(page) {
      emit('navigate', page);
    }
    const statusClass = computed(() => (props.modelReady ? 'online' : 'offline'));
    const statusText = computed(() => (props.modelReady ? '模型就绪' : '模型未连接'));
    return { go, statusClass, statusText };
  },
  /**
   * 根元素即 <nav class="sidebar">，直接作为 #app Grid 子元素，
   * 匹配 grid-area: sidebar。
   */
  template: `
    <nav class="sidebar" :class="{ open: open }">
      <!-- Logo -->
      <div class="sidebar-logo">
        <span class="logo-icon"><app-icon name="leaf" :size="22"></app-icon></span>
        <div class="logo-title">AgriDiagnose</div>
        <div class="logo-subtitle">智慧农业诊断系统</div>
      </div>
      <div class="sidebar-divider"></div>

      <!-- 导航列表 -->
      <ul class="sidebar-nav">
        <li
          v-for="(page, key) in pages"
          :key="key"
          class="nav-item"
          :class="{ active: currentPage === key }"
          @click="go(key)"
        >
          <span class="nav-icon"><app-icon :name="page.icon" :size="18"></app-icon></span>
          <span class="nav-text">{{ page.title }}</span>
        </li>
      </ul>

      <!-- 底部状态栏 — 呼吸灯效果 -->
      <div class="sidebar-status">
        <div class="status-row">
          <span class="status-dot" :class="statusClass"></span>
          <span class="status-text">{{ statusText }}</span>
        </div>
        <div class="status-version">v2.0.0</div>
      </div>
    </nav>
  `,
};
