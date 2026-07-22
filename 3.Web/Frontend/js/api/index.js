/**
 * AgriDiagnose — 按业务域分组的接口函数（替换旧版全局 window.Api）
 */
import { request } from './client.js';

// ── 诊断 ──
export function predict(file) {
  const fd = new FormData();
  fd.append('file', file);
  return request('POST', '/api/predict', fd);
}

// ── 历史记录 ──
export function getHistory() {
  return request('GET', '/api/history');
}
export function deleteHistory(id) {
  return request('DELETE', `/api/history/${id}`);
}
export function getStats() {
  return request('GET', '/api/stats');
}

// ── 健康检查 ──
export function health() {
  return request('GET', '/api/health');
}

// ── AI 对话（SSE 真流式） ──
export function startChat(diagnosisResult) {
  return request('POST', '/api/chat/start', {
    id: diagnosisResult.id,
    image_url: diagnosisResult.image_url,
    top1: diagnosisResult.top1,
  });
}
/**
 * 打开一条 SSE 流。text 为空 = 首轮诊断开场白，非空 = 多轮追问。
 * 返回原生 EventSource，调用方负责监听 message/close。
 */
export function streamChat(sessionId, text) {
  const qs = text ? `?text=${encodeURIComponent(text)}` : '';
  return new EventSource(`/api/chat/stream/${sessionId}${qs}`);
}

// ── 数据贡献 ──
export function contributeSample(data) {
  return request('POST', '/api/contribute', data);
}
export function getContributeList(status) {
  const qs = status ? `?status=${status}` : '';
  return request('GET', `/api/contribute/list${qs}`);
}
export function getContributeStats() {
  return request('GET', '/api/contribute/stats');
}
export function getContributeClasses() {
  return request('GET', '/api/contribute/classes');
}

// ── 病害百科 ──
export function getEncyclopediaList(params) {
  const qs = new URLSearchParams(params).toString();
  return request('GET', `/api/encyclopedia/list?${qs}`);
}
export function getEncyclopediaDetail(id) {
  return request('GET', `/api/encyclopedia/${id}`);
}
export function getEncyclopediaCrops() {
  return request('GET', '/api/encyclopedia/crops');
}

// ── 管理员 ──
export function adminLogin(password) {
  return request('POST', '/api/admin/login', { password }, true);
}
export function adminLogout() {
  return request('POST', '/api/admin/logout', null);
}
export function adminReview(id, approved, notes) {
  return request('POST', `/api/admin/review/${id}`, {
    approved,
    notes: notes || '',
  });
}
export function adminBatchReview(ids, approved, notes) {
  return request('POST', '/api/admin/review/batch', { ids, approved, notes: notes || '' });
}

// ── 管理后台：仪表盘 ──
export function adminDashboardOverview() {
  return request('GET', '/api/admin/dashboard/overview');
}
export function adminDashboardTrends(days = 30) {
  return request('GET', `/api/admin/dashboard/trends?days=${days}`);
}
export function adminDashboardDistribution() {
  return request('GET', '/api/admin/dashboard/distribution');
}

// ── 管理后台：模型管理 ──
export function adminModelInfo() {
  return request('GET', '/api/admin/model/info');
}
export function adminModelDevices() {
  return request('GET', '/api/admin/model/devices');
}
export function adminModelTrain(params) {
  return request('POST', '/api/admin/model/train', params);
}
export function adminModelTrainingStatus() {
  return request('GET', '/api/admin/model/training/status');
}
export function adminModelTrainingCancel() {
  return request('POST', '/api/admin/model/training/cancel');
}

// ── 管理后台：系统配置 ──
export function adminConfigLlm() {
  return request('GET', '/api/admin/config/llm');
}
export function adminConfigLlmUpdate(providerId, data) {
  return request('PUT', `/api/admin/config/llm/${providerId}`, data);
}
export function adminConfigSetActive(providerId) {
  return request('PUT', `/api/admin/config/active/${providerId}`);
}
export function adminConfigLlmTest(providerId, data) {
  return request('POST', '/api/admin/config/llm/test', { provider_id: providerId, ...data });
}
export function adminConfigSystem() {
  return request('GET', '/api/admin/config/system');
}
export function adminConfigSystemUpdate(data) {
  return request('PUT', '/api/admin/config/system', data);
}

// ── 管理后台：百科管理 ──
export function adminEncyclopediaCreate(data) {
  return request('POST', '/api/admin/encyclopedia', data);
}
export function adminEncyclopediaUpdate(id, data) {
  return request('PUT', `/api/admin/encyclopedia/${id}`, data);
}
export function adminEncyclopediaDelete(id) {
  return request('DELETE', `/api/admin/encyclopedia/${id}`);
}

// ── 管理后台：用户管理 ──
export function adminUsersList(params) {
  const qs = new URLSearchParams(params || {}).toString();
  return request('GET', `/api/admin/users?${qs}`);
}
export function adminUsersUpdate(id, data) {
  return request('PUT', `/api/admin/users/${id}`, data);
}

// ── 用户系统 ──
export function authRegister(data) {
  return request('POST', '/api/auth/register', data, true);
}
export function authLogin(data) {
  return request('POST', '/api/auth/login', data, true);
}
export function authLogout() {
  return request('POST', '/api/auth/logout', null);
}
export function authProfile() {
  return request('GET', '/api/auth/profile');
}
export function authProfileUpdate(data) {
  return request('PUT', '/api/auth/profile', data);
}
export function authProfileStats() {
  return request('GET', '/api/auth/profile/stats');
}
