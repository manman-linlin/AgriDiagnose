/**
 * 数据贡献页共享的参考数据缓存（38 类中英文对照列表，跨次进入页面无需重复请求）
 */
import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { getContributeClasses } from '../api/index.js';

export const useContributeStore = defineStore('contribute', () => {
  const state = reactive({
    classList: [],
    loaded: false,
  });

  async function loadClasses(force = false) {
    if (state.loaded && !force) return state.classList;
    try {
      state.classList = (await getContributeClasses()) || [];
      state.loaded = true;
    } catch {
      state.classList = [];
    }
    return state.classList;
  }

  return { state, loadClasses };
});
