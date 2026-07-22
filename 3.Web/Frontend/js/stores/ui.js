/**
 * 全局 UI 状态：Toast 通知 + 系统健康状态
 */
import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { health } from '../api/index.js';

export const useUiStore = defineStore('ui', () => {
  const toast = reactive({
    visible: false,
    type: 'success',   // 'success' | 'error' | 'warning' | 'info'
    message: '',
    timer: null,
  });

  const system = reactive({
    modelReady: false,     // 从 /api/health 获取
    healthChecked: false,
    offline: false,        // 网络状态
  });

  /** 全局通知中心（持久化到 localStorage） */
  const notifications = reactive([]);

  function showToast(message, type = 'success', duration = 3000) {
    if (toast.timer) clearTimeout(toast.timer);
    toast.message = message;
    toast.type = type;
    toast.visible = true;
    toast.timer = setTimeout(() => {
      toast.visible = false;
    }, duration);
  }

  function addNotification(type, title, message, actionUrl = '') {
    const item = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type,
      title,
      message,
      time: new Date().toLocaleString('zh-CN'),
      read: false,
      actionUrl,
    };
    notifications.unshift(item);
    // 保留最近 50 条
    if (notifications.length > 50) notifications.length = 50;
    try { localStorage.setItem('agridiag_notifications', JSON.stringify(notifications)); } catch {}
  }

  function restoreNotifications() {
    try {
      const saved = localStorage.getItem('agridiag_notifications');
      if (saved) {
        const list = JSON.parse(saved);
        notifications.splice(0, notifications.length, ...list);
      }
    } catch {}
  }

  async function checkHealth() {
    try {
      const data = await health();
      system.modelReady = data.model_ready;
    } catch {
      system.modelReady = false;
    }
    system.healthChecked = true;
  }

  // 网络状态监听
  if (typeof window !== 'undefined') {
    window.addEventListener('online', () => {
      system.offline = false;
      showToast('网络已恢复', 'info', 2000);
    });
    window.addEventListener('offline', () => {
      system.offline = true;
      showToast('网络连接已断开', 'warning', 0);
    });
  }

  return { toast, system, notifications, showToast, addNotification, restoreNotifications, checkHealth };
});
