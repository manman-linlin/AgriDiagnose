/**
 * AgriDiagnose — 根组件
 * 顶栏 + 侧边栏 + 管理员登录弹窗 + 主内容区（动态页面）+ 手机端底部导航
 *
 * 重要：模板顶层元素直接是 #app 的子节点（多根 fragment），
 * 因为 layout.css 里的 CSS Grid（grid-template-areas）是挂在 #app 元素上，
 * 子元素（topbar/sidebar/main）靠自身 class 对齐 grid-area，这里不能再套一层 div。
 */
import { ref, computed, onMounted } from 'vue';
import { PAGES, currentPage, currentTitle, navigate as routerNavigate, initRouter } from '../router/index.js';
import { useUiStore } from '../stores/ui.js';
import { useAdminStore } from '../stores/admin.js';
import AppTopbar from '../layout/Topbar.js';
import AppSidebar from '../layout/Sidebar.js';
import AppMobileBottomNav from '../layout/MobileBottomNav.js';
import AppIcon from '../shared/components/AppIcon.js';
import PageDiagnose from '../features/diagnose/page.js';
import PageChat from '../features/chat/page.js';
import PageContribute from '../features/contribute/page.js';
import PageEncyclopedia from '../features/encyclopedia/page.js';
import PageHistory from '../features/history/page.js';

const PAGE_COMPONENTS = {
  diagnose: PageDiagnose,
  chat: PageChat,
  contribute: PageContribute,
  encyclopedia: PageEncyclopedia,
  history: PageHistory,
};

export default {
  name: 'App',
  components: { AppTopbar, AppSidebar, AppMobileBottomNav, AppIcon },
  setup() {
    const ui = useUiStore();
    const admin = useAdminStore();
    const sidebarOpen = ref(false);

    function navigate(page) {
      routerNavigate(page);
      sidebarOpen.value = false;
    }
    function toggleSidebar() { sidebarOpen.value = !sidebarOpen.value; }
    function closeSidebar() { sidebarOpen.value = false; }

    const activeComponent = computed(() => PAGE_COMPONENTS[currentPage.value] || PageDiagnose);

    onMounted(() => {
      initRouter();
      ui.checkHealth();
      admin.restoreSession();
    });

    return {
      ui, admin, sidebarOpen, pages: PAGES, currentPage, currentTitle,
      navigate, toggleSidebar, closeSidebar, activeComponent,
    };
  },
  template: `
    <div v-if="ui.toast.visible" class="toast" :class="ui.toast.type">{{ ui.toast.message }}</div>

    <app-topbar
      :current-title="currentTitle"
      :sidebar-open="sidebarOpen"
      @toggle-sidebar="toggleSidebar"
    ></app-topbar>

    <app-sidebar
      :current-page="currentPage"
      :pages="pages"
      :model-ready="ui.system.modelReady"
      :open="sidebarOpen"
      @navigate="navigate"
    ></app-sidebar>

    <div class="sidebar-overlay" :class="{ open: sidebarOpen }" @click="closeSidebar"></div>

    <!-- 管理员登录弹窗 -->
    <div v-if="admin.state.showLoginModal" class="modal-overlay" @click.self="admin.toggleLoginModal()">
      <div class="modal-dialog">
        <button class="modal-close" @click="admin.toggleLoginModal()"><app-icon name="x" :size="16"></app-icon></button>
        <div class="modal-header">
          <div class="modal-icon"><app-icon name="lock" :size="32"></app-icon></div>
          <h2 class="modal-title">管理员登录</h2>
          <p class="modal-subtitle">请输入管理员密码以审核用户提交的数据</p>
        </div>
        <div class="modal-body">
          <div class="form-group">
            <label class="form-label">密码</label>
            <input
              type="password"
              class="form-input"
              v-model="admin.state.loginPassword"
              placeholder="请输入管理员密码"
              @keyup.enter="admin.login()"
              autofocus
            />
          </div>
          <div v-if="admin.state.loginError" class="form-error-msg" style="margin-bottom:12px;display:flex;align-items:center;gap:4px;">
            <app-icon name="alert-triangle" :size="14"></app-icon> {{ admin.state.loginError }}
          </div>
          <button
            class="btn btn-primary btn-block"
            :disabled="admin.state.loginLoading"
            @click="admin.login()"
          >
            <app-icon v-if="!admin.state.loginLoading" name="key" :size="16"></app-icon>
            {{ admin.state.loginLoading ? '登录中...' : '登录' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 主内容区（唯一可滚动区域） -->
    <main class="main-content">
      <div class="page-container">
        <Transition name="page" mode="out-in">
          <component :is="activeComponent" :key="currentPage"></component>
        </Transition>
      </div>
    </main>

    <!-- 手机端底部导航 -->
    <app-mobile-bottom-nav
      :current-page="currentPage"
      :pages="pages"
      @navigate="navigate"
    ></app-mobile-bottom-nav>
  `,
};
