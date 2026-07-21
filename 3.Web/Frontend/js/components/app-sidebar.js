/** 侧边栏导航组件 — Grid 布局适配版 */
window.makeAppSidebar = function () {
  return {
    props: {
      currentPage: { type: String, default: 'diagnose' },
      pages:       { type: Object, default: () => ({}) },
      modelReady:  { type: Boolean, default: false },
      open:        { type: Boolean, default: false },   // 手机端由父组件控制
    },
    emits: ['navigate'],
    methods: {
      go(page) {
        this.$emit('navigate', page);
      },
    },
    /**
     * 根元素即 <nav class="sidebar">，直接作为 #app Grid 子元素，
     * 匹配 grid-area: sidebar。
     * 汉堡按钮和遮罩层已移至 index.html 顶部栏。
     */
    template: `
      <nav class="sidebar" :class="{ open: open }">
        <!-- Logo -->
        <div class="sidebar-logo">
          <span class="logo-icon">🌾</span>
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
            <span class="nav-icon">{{ page.icon }}</span>
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
    computed: {
      statusClass() {
        if (this.modelReady) return 'online';
        return 'offline';
      },
      statusText() {
        if (this.modelReady) return '模型就绪';
        return '模型未连接';
      },
    },
  };
};
