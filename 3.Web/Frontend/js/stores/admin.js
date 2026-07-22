/**
 * 管理员认证状态：登录/退出/会话恢复
 */
import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { adminLogin, adminLogout } from '../api/index.js';
import { setToken, onUnauthorized } from '../api/authToken.js';
import { useUiStore } from './ui.js';

const STORAGE_KEY = 'agridiag_admin_token';

export const useAdminStore = defineStore('admin', () => {
  const state = reactive({
    loggedIn: false,
    token: null,
    showLoginModal: false,
    loginPassword: '',
    loginError: '',
    loginLoading: false,
  });

  function clearSession() {
    state.token = null;
    state.loggedIn = false;
    setToken(null);
    localStorage.removeItem(STORAGE_KEY);
  }

  // 401 时自动清除过期 token（由 api/client.js 触发）
  onUnauthorized(clearSession);

  /** 尝试从 localStorage 恢复管理员登录态 */
  function restoreSession() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      state.token = saved;
      state.loggedIn = true;
      setToken(saved);
    }
  }

  async function login() {
    const ui = useUiStore();
    const pwd = state.loginPassword;
    if (!pwd) {
      state.loginError = '请输入密码';
      return;
    }
    state.loginLoading = true;
    state.loginError = '';
    try {
      const data = await adminLogin(pwd);
      state.token = data.token;
      state.loggedIn = true;
      state.loginPassword = '';
      state.showLoginModal = false;
      setToken(data.token);
      localStorage.setItem(STORAGE_KEY, data.token);
      ui.showToast('管理员登录成功', 'success');
      // 直接跳转管理后台
      location.hash = '#/admin/dashboard';
    } catch (e) {
      state.loginError = e.message || '登录失败';
    } finally {
      state.loginLoading = false;
    }
  }

  function logout() {
    const ui = useUiStore();
    adminLogout().catch(() => {});
    clearSession();
    state.loginPassword = '';
    state.loginError = '';
    ui.showToast('已退出管理员账号', 'warning', 2000);
    // 如果当前在管理后台，退出后跳回首页
    if ((location.hash || '').startsWith('#/admin')) {
      location.hash = '#/diagnose';
    }
  }

  function toggleLoginModal() {
    state.showLoginModal = !state.showLoginModal;
    if (!state.showLoginModal) {
      state.loginPassword = '';
      state.loginError = '';
    }
  }

  return { state, restoreSession, login, logout, toggleLoginModal };
});
