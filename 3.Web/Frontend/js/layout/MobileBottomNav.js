/**
 * 手机端底部 Tab 导航（<768px 显示）
 * 复用 responsive.css 中早已写好但从未启用的 .mobile-bottom-nav / .mob-nav-item 样式，
 * 与侧滑抽屉互补：抽屉仍可通过顶栏汉堡按钮打开，底部导航负责最常用的 5 页快速切换。
 */
import AppIcon from '../shared/components/AppIcon.js';

export default {
  name: 'AppMobileBottomNav',
  components: { AppIcon },
  props: {
    currentPage: { type: String, default: 'diagnose' },
    pages:       { type: Object, default: () => ({}) },
  },
  emits: ['navigate'],
  setup(props, { emit }) {
    function go(key) { emit('navigate', key); }
    return { go };
  },
  template: `
    <nav class="mobile-bottom-nav">
      <button
        v-for="(page, key) in pages"
        :key="key"
        class="mob-nav-item"
        :class="{ active: currentPage === key }"
        type="button"
        @click="go(key)"
      >
        <span class="mob-nav-icon"><app-icon :name="page.icon" :size="18"></app-icon></span>
        <span>{{ page.title }}</span>
      </button>
    </nav>
  `,
};
