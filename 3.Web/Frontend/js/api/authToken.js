/**
 * 管理员鉴权 token 的独立持有模块。
 * 独立出来是为了打破 api/client.js ↔ stores/admin.js 的循环依赖：
 * client 只需要「读 token / 收到 401 时通知一下」，不需要知道 Pinia store 的存在。
 */
let currentToken = null;
let unauthorizedHandler = null;

export function getToken() {
  return currentToken;
}

export function setToken(token) {
  currentToken = token;
}

/** 由 stores/admin.js 注册：收到 401 时如何清理会话由 store 自己决定 */
export function onUnauthorized(handler) {
  unauthorizedHandler = handler;
}

export function notifyUnauthorized() {
  if (unauthorizedHandler) unauthorizedHandler();
}
