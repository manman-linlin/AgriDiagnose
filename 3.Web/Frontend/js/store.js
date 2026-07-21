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
});
