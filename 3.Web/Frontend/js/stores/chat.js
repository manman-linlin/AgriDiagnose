/**
 * AI 对话会话状态
 */
import { defineStore } from 'pinia';
import { reactive } from 'vue';

export const useChatStore = defineStore('chat', () => {
  const state = reactive({
    sessionId: null,
    messages: [],        // [{ role: 'user'|'assistant', content, ... }]
    loading: false,
  });

  function reset() {
    state.sessionId = null;
    state.messages = [];
    state.loading = false;
  }

  return { state, reset };
});
