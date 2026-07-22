/**
 * AI 对话 SSE 收发逻辑 composable —— 从对话页面中抽出，与具体 DOM（滚动/输入框）解耦，
 * 便于复用与单独测试。
 */
import { ref } from 'vue';
import { streamChat } from '../../../api/index.js';

/**
 * @param {object} chatState - Pinia chat store 的 reactive state（含 sessionId / messages 数组）
 * @param {object} options
 * @param {(message: string, type?: string) => void} [options.onToast] - 出错时的提示回调
 */
export function useChatStream(chatState, { onToast } = {}) {
  const loading = ref(false);
  const typingText = ref('');
  const typingMsgIdx = ref(-1);
  let activeStream = null;

  function closeStream() {
    if (activeStream) {
      activeStream.close();
      activeStream = null;
    }
    typingMsgIdx.value = -1;
  }

  /** 打开一条 SSE 流：text 为空 = 首轮诊断开场白，非空 = 多轮追问 */
  function openStream(text) {
    loading.value = true;
    closeStream();

    let msgIdx = -1;
    let full = '';
    const es = streamChat(chatState.sessionId, text);
    activeStream = es;

    es.onmessage = (ev) => {
      let payload;
      try { payload = JSON.parse(ev.data); } catch { return; }

      if (payload.type === 'delta') {
        if (msgIdx === -1) {
          chatState.messages.push({ role: 'assistant', content: '', advice: null, review: null, time: new Date().toLocaleTimeString() });
          msgIdx = chatState.messages.length - 1;
          typingMsgIdx.value = msgIdx;
          typingText.value = '';
          loading.value = false;
        }
        full += payload.text;
        typingText.value = full;
      } else if (payload.type === 'done') {
        if (msgIdx === -1) {
          chatState.messages.push({
            role: 'assistant',
            content: full,
            advice: payload.advice || null,
            review: payload.review || null,
            time: new Date().toLocaleTimeString(),
          });
        } else {
          chatState.messages[msgIdx].content = full;
          if (payload.advice) chatState.messages[msgIdx].advice = payload.advice;
          if (payload.review) chatState.messages[msgIdx].review = payload.review;
        }
        loading.value = false;
        closeStream();
      } else if (payload.type === 'error') {
        loading.value = false;
        onToast && onToast(payload.message || 'AI 服务异常', 'error');
        closeStream();
      }
    };

    es.onerror = () => {
      loading.value = false;
      onToast && onToast('AI 连接异常，请重试', 'error');
      closeStream();
    };
  }

  return { loading, typingText, typingMsgIdx, openStream, closeStream };
}
