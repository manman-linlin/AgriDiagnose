/** 顶部固定栏 */
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
    function showAdminLogin() { admin.toggleLoginModal(); }
    function goAdmin() { location.hash = '#/admin/dashboard'; }
    return { admin, toggleSidebar, showAdminLogin, goAdmin };
  },
  template: `
    <header class="topbar">
      <button class="hamburger-btn" @click="toggleSidebar" :class="{ open: sidebarOpen }">
        <app-icon name="menu" :size="20"></app-icon>
      </button>

      <div class="topbar-logo">
        <span class="logo-icon"><app-icon name="leaf" :size="20"></app-icon></span>
        <span class="logo-text">AgriDiagnose</span>
      </div>

      <nav class="topbar-breadcrumb">
        <span class="breadcrumb-item current">{{ currentTitle }}</span>
      </nav>

      <div class="topbar-actions">
        <template v-if="admin.state.loggedIn">
          <button class="btn btn-sm btn-outline" @click="goAdmin" style="margin-right:8px;">⚙️ 管理后台</button>
          <button class="btn btn-sm btn-outline" @click="admin.logout()">
            <app-icon name="log-out" :size="14"></app-icon> 退出
          </button>
        </template>
        <template v-else>
          <button class="btn btn-sm btn-outline" @click="showAdminLogin">
            ⚙️ 后台管理
          </button>
        </template>
      </div>
    </header>
  `,
};
