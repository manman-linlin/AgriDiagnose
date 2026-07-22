/** 顶部固定栏 — 从 index.html 内联模板拆出 */
import { useAdminStore } from '../stores/admin.js';
import AppIcon from '../shared/components/AppIcon.js';

export default {
  name: 'AppTopbar',
  components: { AppIcon },
  props: {
    currentTitle: { type: String, default: '' },
    sidebarOpen:  { type: Boolean, default: false },
  },
  emits: ['toggle-sidebar'],
  setup(props, { emit }) {
    const admin = useAdminStore();
    function toggleSidebar() { emit('toggle-sidebar'); }
    function showLoginModal() { admin.toggleLoginModal(); }
    return { admin, toggleSidebar, showLoginModal };
  },
  template: `
    <header class="topbar">
      <!-- 汉堡按钮（平板/手机端） -->
      <button class="hamburger-btn" @click="toggleSidebar" :class="{ open: sidebarOpen }">
        <app-icon name="menu" :size="20"></app-icon>
      </button>

      <!-- Logo + 系统名 -->
      <div class="topbar-logo">
        <span class="logo-icon"><app-icon name="leaf" :size="20"></app-icon></span>
        <span class="logo-text">AgriDiagnose</span>
      </div>

      <!-- 面包屑 -->
      <nav class="topbar-breadcrumb">
        <span class="breadcrumb-item current">{{ currentTitle }}</span>
      </nav>

      <!-- 右侧用户区 -->
      <div class="topbar-actions">
        <template v-if="admin.state.loggedIn">
          <div class="admin-badge" @click="admin.logout()" title="点击退出">
            <app-icon name="user" :size="14"></app-icon>
            <span>管理员</span>
            <span class="admin-logout-hint">退出</span>
          </div>
        </template>
        <template v-else>
          <button class="btn-admin-login" @click="showLoginModal">
            <app-icon name="lock" :size="14"></app-icon> 管理员登录
          </button>
        </template>
        <div class="topbar-user">
          <div class="user-avatar">G</div>
          <span class="user-name">游客</span>
        </div>
      </div>
    </header>
  `,
};
