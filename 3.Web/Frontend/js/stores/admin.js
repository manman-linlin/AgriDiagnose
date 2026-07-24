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
    if (!state.loginPassword) {
      state.loginError = '请输入密码';
      return;
    }
    await loginWithPassword(state.loginPassword);
  }

  /** 直接用密码登录（供 AdminLayout 内嵌登录表单使用） */
  async function loginWithPassword(pwd) {
    const ui = useUiStore();
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
      throw e;
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

  return { state, restoreSession, login, loginWithPassword, logout, toggleLoginModal };
});
