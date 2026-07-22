/**
 * 历史记录 + 统计数据缓存
 */
import { defineStore } from 'pinia';
import { reactive } from 'vue';

export const useHistoryStore = defineStore('history', () => {
  const state = reactive({
    records: [],
    stats: [],
  });

  return { state };
});
