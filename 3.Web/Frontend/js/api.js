/**
 * AgriDiagnose — API 请求封装层
 * 所有 HTTP 调用的唯一出口。迁移到小程序时只需改写此文件的 request() 方法。
 * 挂载：window.Api
 */
window.Api = {
  /**
   * 核心请求方法 —— 唯一的 fetch 调用位置
   * @param {string} method - HTTP 方法 (GET/POST/DELETE)
   * @param {string} path   - 接口路径
   * @param {*}      body   - 请求体（FormData 或普通对象）
   * @returns {Promise} 直接返回 data.data 业务数据
   */
  async request(method, path, body, skipAuth = false) {
    const config = { method, headers: {} };

    // 自动附加管理员 token（如有）
    if (!skipAuth && window.AppStore && window.AppStore.admin && window.AppStore.admin.token) {
      config.headers['Authorization'] = 'Bearer ' + window.AppStore.admin.token;
    }

    if (body && !(body instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      config.body = body;
    }

    const res = await fetch(path, config);
    const data = await res.json();

    // 401 时自动清除过期 token
    if (data.code === 401 && window.AppStore && window.AppStore.admin) {
      window.AppStore.admin.token = null;
      window.AppStore.admin.loggedIn = false;
      localStorage.removeItem('agridiag_admin_token');
    }

    if (data.code !== 200) {
      throw new Error(data.message || '请求失败');
    }
    return data.data;
  },

  // ── 诊断 ──
  predict(file) {
    const fd = new FormData();
    fd.append('file', file);
    return this.request('POST', '/api/predict', fd);
  },

  // ── 历史记录 ──
  getHistory() {
    return this.request('GET', '/api/history');
  },
  deleteHistory(id) {
    return this.request('DELETE', `/api/history/${id}`);
  },
  getStats() {
    return this.request('GET', '/api/stats');
  },

  // ── 健康检查 ──
  health() {
    return this.request('GET', '/api/health');
  },

  // ── AI 对话（SSE 真流式） ──
  startChat(diagnosisResult) {
    return this.request('POST', '/api/chat/start', {
      id: diagnosisResult.id,
      image_url: diagnosisResult.image_url,
      top1: diagnosisResult.top1,
    });
  },
  /**
   * 打开一条 SSE 流。text 为空 = 首轮诊断开场白，非空 = 多轮追问。
   * 返回原生 EventSource，调用方负责监听 message/close。
   */
  streamChat(sessionId, text) {
    const qs = text ? `?text=${encodeURIComponent(text)}` : '';
    return new EventSource(`/api/chat/stream/${sessionId}${qs}`);
  },

  // ── 数据贡献（预留） ──
  contributeSample(data) {
    return this.request('POST', '/api/contribute', data);
  },
  getContributeList(status) {
    const qs = status ? `?status=${status}` : '';
    return this.request('GET', `/api/contribute/list${qs}`);
  },
  getContributeStats() {
    return this.request('GET', '/api/contribute/stats');
  },
  getContributeClasses() {
    return this.request('GET', '/api/contribute/classes');
  },

  // ── 病害百科（预留） ──
  getEncyclopediaList(params) {
    const qs = new URLSearchParams(params).toString();
    return this.request('GET', `/api/encyclopedia/list?${qs}`);
  },
  getEncyclopediaDetail(id) {
    return this.request('GET', `/api/encyclopedia/${id}`);
  },
  getEncyclopediaCrops() {
    return this.request('GET', '/api/encyclopedia/crops');
  },

  // ── 管理员 ──
  adminLogin(password) {
    return this.request('POST', '/api/admin/login', { password: password }, true);
  },
  adminLogout() {
    return this.request('POST', '/api/admin/logout', null);
  },
  adminReview(id, approved, notes) {
    return this.request('POST', `/api/admin/review/${id}`, {
      approved: approved,
      notes: notes || '',
    });
  },
};
