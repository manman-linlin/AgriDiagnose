/**
 * 管理后台布局容器 — 固定全视口覆盖层
 * 独立侧边栏(200px) + 内容区，完全覆盖主应用布局
 */
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import { ADMIN_PAGES, navigateToAdmin } from '../../router/index.js';
import { useAdminStore } from '../../stores/admin.js';
import { useUiStore } from '../../stores/ui.js';
import { getContributeStats } from '../../api/index.js';
import AppIcon from '../../shared/components/AppIcon.js';
import AppLoading from '../../shared/components/AppLoading.js';

/* 子页面组件 */
import DashboardPage from './dashboard/page.js';
import ReviewPage from './review/page.js';
import ModelPage from './model/page.js?v=model-admin-20260723-3';
import SettingsPage from './settings/page.js';
import EncyclopediaPage from './encyclopedia/page.js';
import UsersPage from './users/page.js';
import LogsPage from './logs/page.js';

const SUB_PAGES = {
  dashboard:    DashboardPage,
  review:       ReviewPage,
  model:        ModelPage,
  settings:     SettingsPage,
  encyclopedia: EncyclopediaPage,
  users:        UsersPage,
  logs:         LogsPage,
};

function getSubFromHash() {
  const hash = (location.hash || '').replace(/^#\/?/, '');
  if (!hash.startsWith('admin/')) return 'dashboard';
  const key = hash.slice(6);
  return ADMIN_PAGES[key] ? key : 'dashboard';
}

export default {
  name: 'AdminLayout',
  components: { AppIcon, AppLoading },
  setup() {
    const admin = useAdminStore();
    const ui = useUiStore();
    const subPage = ref(getSubFromHash());
    const sidebarOpen = ref(false);
    const pendingCount = ref(0);
    const showNotifications = ref(false);
    let pollTimer = null;

    const unreadCount = computed(() => ui.notifications.filter(n => !n.read).length);

    function markAllRead() { ui.notifications.forEach(n => { n.read = true; }); }
    function clearNotifications() {
      ui.notifications.splice(0);
      try { localStorage.removeItem('agridiag_notifications'); } catch {}
    }
    function toggleNotifications() { showNotifications.value = !showNotifications.value; }

    function goBack() { location.hash = '#/diagnose'; }

    function selectSub(key) {
      subPage.value = key;
      navigateToAdmin(key);
      sidebarOpen.value = false;
    }

    function syncFromHash() {
      const key = getSubFromHash();
      if (subPage.value !== key) {
        subPage.value = key;
      }
    }

    async function loadPendingCount() {
      try {
        const stats = await getContributeStats();
        pendingCount.value = stats.pending_count || 0;
      } catch { /* 静默 */ }
    }

    function onDocClick() { showNotifications.value = false; }

    onMounted(() => {
      syncFromHash();
      window.addEventListener('hashchange', syncFromHash);
      document.addEventListener('click', onDocClick);
      ui.restoreNotifications();
      loadPendingCount();
      pollTimer = setInterval(loadPendingCount, 30000);
    });

    onBeforeUnmount(() => {
      if (pollTimer) clearInterval(pollTimer);
      document.removeEventListener('click', onDocClick);
    });

    const currentSub = computed(() => SUB_PAGES[subPage.value] || DashboardPage);
    const currentTitle = computed(() => ADMIN_PAGES[subPage.value]?.title || '');

    return {
      admin, ui, subPage, sidebarOpen, pendingCount, showNotifications, unreadCount,
      currentSub, currentTitle,
      goBack, selectSub, ADMIN_PAGES,
      markAllRead, clearNotifications, toggleNotifications,
      toggleSidebar() { sidebarOpen.value = !sidebarOpen.value; },
      closeSidebar() { sidebarOpen.value = false; },
    };
  },
  template: `
    <div style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:250;display:grid;grid-template-columns:200px 1fr;grid-template-rows:56px 1fr;background:var(--color-page-bg);">
      <!-- 网络离线横幅 -->
      <div v-if="ui.system.offline" style="position:fixed;top:56px;left:0;right:0;z-index:260;height:32px;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--color-warning-bg);color:var(--color-warning);font-size:13px;font-weight:500;">
        <app-icon name="alert-triangle" :size="14"></app-icon> 网络连接已断开，部分功能不可用
      </div>

      <!-- 顶部栏 -->
      <header style="grid-column:1/-1;display:flex;align-items:center;gap:16px;padding:0 20px;background:var(--color-card);border-bottom:1px solid var(--color-border-light);">
        <button class="btn btn-sm btn-outline" @click="goBack" style="display:flex;align-items:center;gap:4px;">
          <app-icon name="chevron-down" :size="14" style="transform:rotate(90deg);"></app-icon> 返回前台
        </button>
        <span style="font-weight:700;font-size:var(--font-size-lg);color:var(--color-primary-dark);">AgriDiagnose 管理后台</span>
        <span style="margin-left:auto;display:flex;align-items:center;gap:8px;font-size:var(--font-size-sm);color:var(--color-text-hint);">
          <span class="status-dot" :style="{width:'8px',height:'8px',borderRadius:'50%',background:ui.system.offline?'var(--color-error)':'var(--color-success)'}"></span>
          {{ currentTitle }}
        </span>
        <!-- 通知铃铛 -->
        <div style="position:relative;">
          <button class="btn btn-sm btn-outline" @click="toggleNotifications" style="position:relative;">
            <app-icon name="bell" :size="14"></app-icon>
            <span v-if="unreadCount" style="position:absolute;top:-6px;right:-6px;background:var(--color-error);color:#fff;font-size:10px;font-weight:700;min-width:16px;height:16px;line-height:16px;text-align:center;border-radius:8px;padding:0 4px;">{{ unreadCount > 99 ? '99+' : unreadCount }}</span>
          </button>
          <!-- 通知下拉面板 -->
          <div v-if="showNotifications" class="notification-dropdown" @click.stop style="position:absolute;top:40px;right:0;width:360px;max-height:420px;background:var(--color-card);border:1px solid var(--color-border);border-radius:10px;box-shadow:var(--shadow-lg);z-index:300;overflow:hidden;">
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-bottom:1px solid var(--color-border-light);">
              <strong>通知中心</strong>
              <div style="display:flex;gap:6px;">
                <button @click="markAllRead" style="font-size:11px;border:none;background:none;color:var(--color-primary);cursor:pointer;">全部已读</button>
                <button @click="clearNotifications" style="font-size:11px;border:none;background:none;color:var(--color-text-hint);cursor:pointer;">清空</button>
              </div>
            </div>
            <div style="overflow-y:auto;max-height:340px;">
              <div v-if="!ui.notifications.length" style="text-align:center;padding:40px;color:var(--color-text-hint);">暂无通知</div>
              <div v-for="n in ui.notifications" :key="n.id" @click="n.read=true" :style="{padding:'12px 16px',borderBottom:'1px solid var(--color-border-light)',cursor:'pointer',background:n.read?'var(--color-card)':'var(--color-primary-bg)'}">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
                  <span style="font-weight:600;font-size:14px;">{{ n.title }}</span>
                  <span style="font-size:11px;color:var(--color-text-hint);">{{ n.time }}</span>
                </div>
                <div style="font-size:13px;color:var(--color-text-secondary);">{{ n.message }}</div>
              </div>
            </div>
          </div>
        </div>
        <button class="btn btn-sm btn-outline" @click="admin.logout()" v-if="admin.state.loggedIn">
          <app-icon name="key" :size="14"></app-icon> 退出
        </button>
      </header>

      <!-- 管理侧边栏 -->
      <nav style="background:var(--color-sidebar);color:#fff;display:flex;flex-direction:column;overflow-y:auto;">
        <div style="padding:16px;text-align:center;border-bottom:1px solid rgba(255,255,255,0.1);">
          <div style="font-size:11px;color:rgba(255,255,255,0.5);">管理导航</div>
        </div>
        <ul style="flex:1;list-style:none;padding:8px 0;">
          <li v-for="(page, key) in ADMIN_PAGES" :key="key"
            class="nav-item"
            :class="{ active: subPage === key }"
            @click="selectSub(key)"
            style="display:flex;align-items:center;gap:10px;padding:12px 18px;cursor:pointer;color:rgba(255,255,255,0.65);font-size:var(--font-size-md);border-left:3px solid transparent;transition:all 0.2s;">
            <app-icon :name="page.icon" :size="16" style="flex-shrink:0;"></app-icon>
            <span>{{ page.title }}</span>
            <span v-if="key==='review' && pendingCount > 0"
              style="margin-left:auto;background:var(--color-error);color:#fff;font-size:10px;font-weight:700;min-width:18px;height:18px;line-height:18px;text-align:center;border-radius:9px;padding:0 5px;">
              {{ pendingCount > 99 ? '99+' : pendingCount }}
            </span>
          </li>
        </ul>
        <div style="padding:12px 16px;border-top:1px solid rgba(255,255,255,0.1);font-size:10px;color:rgba(255,255,255,0.3);">
          v3.0 · Admin
        </div>
      </nav>

      <!-- 内容区（含子页过渡动画） -->
      <main style="overflow-y:auto;padding:24px;">
        <Transition name="page" mode="out-in">
          <component :is="currentSub" :key="subPage"></component>
        </Transition>
      </main>

      <!-- 手机端汉堡按钮 -->
      <button @click="toggleSidebar"
        style="display:none;position:fixed;top:10px;left:10px;z-index:260;width:40px;height:40px;background:var(--color-primary);color:#fff;border:none;border-radius:8px;font-size:18px;"
        class="admin-hamburger">
        ☰
      </button>

      <!-- 手机端遮罩 -->
      <div v-if="sidebarOpen" @click="closeSidebar"
        style="display:none;position:fixed;top:0;left:0;right:0;bottom:0;background:rgba(0,0,0,0.4);z-index:255;"
        class="admin-overlay"></div>
    </div>
  `,
};
