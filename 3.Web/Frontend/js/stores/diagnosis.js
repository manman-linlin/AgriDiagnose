/**
 * 当前诊断上下文：图片、识别结果、状态
 */
import { defineStore } from 'pinia';
import { reactive } from 'vue';

export const useDiagnosisStore = defineStore('diagnosis', () => {
  const state = reactive({
    imageUrl: null,      // 当前上传图片的预览 URL（blob URL）
    imageFile: null,     // 用于贡献样本时拿到的 File 对象
    result: null,        // /api/predict 返回的完整 result（含 top1, top3）
    status: 'idle',      // 'idle' | 'uploading' | 'loading' | 'done' | 'error'
    error: null,
  });

  function reset() {
    state.imageUrl = null;
    state.imageFile = null;
    state.result = null;
    state.status = 'idle';
    state.error = null;
  }

  function setResult(data) {
    state.result = data;
    state.status = 'done';
    state.error = null;
  }

  function setError(msg) {
    state.status = 'error';
    state.error = msg;
  }

  return { state, reset, setResult, setError };
});
