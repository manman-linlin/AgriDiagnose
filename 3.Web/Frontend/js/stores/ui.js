/**
 * 全局 UI 状态：Toast 通知 + 系统健康状态
 */
import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { health } from '../api/index.js';

export const useUiStore = defineStore('ui', () => {
  const toast = reactive({
    visible: false,
    type: 'success',   // 'success' | 'error' | 'warning'
    message: '',
    timer: null,
  });

  const system = reactive({
    modelReady: false,     // 从 /api/health 获取
    healthChecked: false,
  });

  function showToast(message, type = 'success', duration = 3000) {
    if (toast.timer) clearTimeout(toast.timer);
    toast.message = message;
    toast.type = type;
    toast.visible = true;
    toast.timer = setTimeout(() => {
      toast.visible = false;
    }, duration);
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

  return { toast, system, showToast, checkHealth };
});
