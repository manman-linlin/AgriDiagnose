/**
 * AgriDiagnose — 全局响应式状态管理
 * 跨页面共享状态，页面间数据传递的唯一通道。
 * 小程序迁移：对应 app.globalData
 * 挂载：window.AppStore
 */
window.AppStore = Vue.reactive({
  // ── 当前诊断上下文 ──
  diagnosis: {
    imageUrl: null,      // 当前上传图片的预览 URL（blob URL）
    imageFile: null,     // 用于贡献样本时拿到的 File 对象
    result: null,        // /api/predict 返回的完整 result（含 top1, top3）
    status: 'idle',      // 'idle' | 'uploading' | 'loading' | 'done' | 'error'
    error: null,         // 错误信息字符串
  },

  // ── AI 对话 ──
  chat: {
    sessionId: null,
    messages: [],        // [{ role: 'user'|'assistant', content: '...' }]
    loading: false,
  },

  // ── 历史记录缓存 ──
  history: {
    records: [],
    stats: [],
    lastFetch: 0,
  },

  // ── 系统状态 ──
  system: {
    modelReady: false,   // 从 /api/health 获取
    healthChecked: false,
  },

  // ── Toast / 通知 ──
  toast: {
    visible: false,
    type: 'success',     // 'success' | 'error' | 'warning'
    message: '',
    timer: null,
  },

  // ── 管理员状态 ──
  admin: {
    loggedIn: false,
    token: null,
    showLoginModal: false,
    loginPassword: '',
    loginError: '',
    loginLoading: false,
  },

  // ── 方法 ──

  /** 重置诊断状态 */
  resetDiagnosis() {
    this.diagnosis.imageUrl = null;
    this.diagnosis.imageFile = null;
    this.diagnosis.result = null;
    this.diagnosis.status = 'idle';
    this.diagnosis.error = null;
  },

  /** 设置诊断结果 */
  setDiagnosisResult(data) {
    this.diagnosis.result = data;
    this.diagnosis.status = 'done';
    this.diagnosis.error = null;
  },

  /** 设置诊断错误 */
  setDiagnosisError(msg) {
    this.diagnosis.status = 'error';
    this.diagnosis.error = msg;
  },

  /** 显示 Toast 通知 */
  showToast(message, type = 'success', duration = 3000) {
    if (this.toast.timer) clearTimeout(this.toast.timer);
    this.toast.message = message;
    this.toast.type = type;
    this.toast.visible = true;
    this.toast.timer = setTimeout(() => {
      this.toast.visible = false;
    }, duration);
  },

  /** 检查模型状态 */
  async checkHealth() {
    try {
      const data = await window.Api.health();
      this.system.modelReady = data.model_ready;
    } catch {
      this.system.modelReady = false;
    }
    this.system.healthChecked = true;
  },

  // ── 管理员方法 ──

  /** 尝试从 localStorage 恢复管理员登录态 */
  restoreAdminSession() {
    const saved = localStorage.getItem('agridiag_admin_token');
    if (saved) {
      this.admin.token = saved;
      this.admin.loggedIn = true;
    }
  },

  /** 管理员登录 */
  async adminLogin() {
    const pwd = this.admin.loginPassword;
    if (!pwd) {
      this.admin.loginError = '请输入密码';
      return;
    }
    this.admin.loginLoading = true;
    this.admin.loginError = '';
    try {
      const data = await window.Api.adminLogin(pwd);
      this.admin.token = data.token;
      this.admin.loggedIn = true;
      this.admin.loginPassword = '';
      this.admin.showLoginModal = false;
      localStorage.setItem('agridiag_admin_token', data.token);
      this.showToast('管理员登录成功', 'success');
    } catch (e) {
      this.admin.loginError = e.message || '登录失败';
    } finally {
      this.admin.loginLoading = false;
    }
  },

  /** 管理员退出 */
  adminLogout() {
    window.Api.adminLogout().catch(() => {});
    this.admin.token = null;
    this.admin.loggedIn = false;
    this.admin.loginPassword = '';
    this.admin.loginError = '';
    localStorage.removeItem('agridiag_admin_token');
    this.showToast('已退出管理员账号', 'warning', 2000);
  },

  /** 打开/关闭登录弹窗 */
  toggleLoginModal() {
    this.admin.showLoginModal = !this.admin.showLoginModal;
    if (!this.admin.showLoginModal) {
      this.admin.loginPassword = '';
      this.admin.loginError = '';
    }
  },
});
