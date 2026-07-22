/**
 * AgriDiagnose — API 请求核心方法（唯一的 fetch 调用位置）
 * 迁移到小程序时只需改写此文件。
 */
import { getToken, notifyUnauthorized } from './authToken.js';

/**
 * @param {string} method - HTTP 方法 (GET/POST/DELETE)
 * @param {string} path   - 接口路径
 * @param {*}      body   - 请求体（FormData 或普通对象）
 * @param {boolean} skipAuth - 是否跳过自动附加管理员 token（登录接口本身需要跳过）
 * @returns {Promise} 直接返回 data.data 业务数据
 */
export async function request(method, path, body, skipAuth = false) {
  const config = { method, headers: {} };

  const token = getToken();
  if (!skipAuth && token) {
    config.headers['Authorization'] = 'Bearer ' + token;
  }

  if (body && !(body instanceof FormData)) {
    config.headers['Content-Type'] = 'application/json';
    config.body = JSON.stringify(body);
  } else if (body instanceof FormData) {
    config.body = body;
  }

  const res = await fetch(path, config);
  const data = await res.json();

  if (data.code === 401) {
    notifyUnauthorized();
  }

  if (data.code !== 200) {
    throw new Error(data.message || '请求失败');
  }
  return data.data;
}
