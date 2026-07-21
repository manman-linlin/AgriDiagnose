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
  async request(method, path, body) {
    const config = { method, headers: {} };

    if (body && !(body instanceof FormData)) {
      config.headers['Content-Type'] = 'application/json';
      config.body = JSON.stringify(body);
    } else if (body instanceof FormData) {
      config.body = body;
    }

    const res = await fetch(path, config);
    const data = await res.json();

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

  // ── AI 对话（预留，后续实现） ──
  startChat(file, sessionId) {
    const fd = new FormData();
    fd.append('file', file);
    if (sessionId) fd.append('session_id', sessionId);
    return this.request('POST', '/api/chat/start', fd);
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
};
