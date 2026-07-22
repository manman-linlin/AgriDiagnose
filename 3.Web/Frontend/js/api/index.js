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
