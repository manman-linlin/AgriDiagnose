/**
 * 智能诊断页面 — 优化版：完整状态机过渡、拍摄建议可折叠、上传/诊断/结果流程动画
 */
window.makePageDiagnose = function () {
  const store = window.AppStore;

  return {
    data() {
      return {
        file: null,
        previewUrl: null,
        loading: false,
        tipsExpanded: true,
      };
    },
    computed: {
      result()  { return store.diagnosis.result; },
      error()   { return store.diagnosis.error; },
      showResult() { return store.diagnosis.status === 'done' && !this.loading; },
    },
    methods: {
      // ── 处理文件选择 ──
      onFileChange(file) {
        this.file = file;
        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = URL.createObjectURL(file);
        store.resetDiagnosis();
        store.diagnosis.status = 'uploading';
        store.diagnosis.imageUrl = this.previewUrl;
        store.diagnosis.imageFile = file;
      },

      onClearFile() {
        this.file = null;
        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = null;
        store.resetDiagnosis();
      },

      // ── 提交诊断 ──
      async submit() {
        if (!this.file || this.loading) return;
        this.loading = true;
        store.diagnosis.status = 'loading';
        store.diagnosis.error = null;

        try {
          const data = await window.Api.predict(this.file);
          store.setDiagnosisResult(data);
        } catch (e) {
          store.setDiagnosisError(e.message || '网络请求失败，请确认后端服务已启动');
        } finally {
          this.loading = false;
        }
      },

      // ── 操作入口 ──
      goChat()         { window.AppRouter.navigate('chat'); },
      goContribute()   { window.AppRouter.navigate('contribute'); },
      goEncyclopedia() { window.AppRouter.navigate('encyclopedia'); },
      resetDiagnosis() {
        this.file = null;
        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = null;
        store.resetDiagnosis();
      },

      // ── 拍摄建议折叠 ──
      toggleTips() { this.tipsExpanded = !this.tipsExpanded; },

      // ── 拖拽事件 ──
      onDragover(e)  { e.preventDefault(); },
      onDragleave(e) { e.preventDefault(); },
      onDrop(e) {
        e.preventDefault();
        const file = e.dataTransfer.files[0];
        if (file) this.onFileChange(file);
      },
    },
    template: `
      <div>
        <!-- ═══ 上传区域 ═══ -->
        <div class="card" style="animation: fadeScaleIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);">
          <div class="card-header">📷 上传叶片图片</div>
          <app-image-uploader
            :preview-url="previewUrl"
            :disabled="loading"
            @file-change="onFileChange"
            @clear="onClearFile"
          ></app-image-uploader>

          <button
            class="btn btn-primary btn-block"
            :disabled="!file || loading"
            @click="submit"
            style="margin-top:14px;"
          >
            {{ loading ? '⏳ 识别中...' : '🔍 开始诊断' }}
          </button>
          <button
            v-if="file && !loading"
            class="btn btn-outline btn-block"
            style="margin-top:10px;"
            @click="resetDiagnosis"
          >重新选择</button>
        </div>

        <!-- ═══ 加载态 ═══ -->
        <app-loading
          v-if="loading"
          text="正在分析叶片特征，识别病害类型..."
        ></app-loading>

        <!-- ═══ 错误态 ═══ -->
        <app-error
          v-if="error && !loading"
          :message="error"
          :retryable="true"
          @retry="submit"
        ></app-error>

        <!-- ═══ 结果 ═══ -->
        <app-result-card
          v-if="showResult"
          :result="result"
          @chat="goChat"
          @contribute="goContribute"
          @encyclopedia="goEncyclopedia"
          @reset="resetDiagnosis"
        ></app-result-card>

        <!-- ═══ 拍摄提示（可折叠） ═══ -->
        <div class="card card-info-tip" style="margin-top:0;">
          <div
            class="tips-toggle"
            style="font-size:14px;font-weight:600;color:var(--color-text-secondary);display:flex;justify-content:space-between;align-items:center;"
            @click="toggleTips"
          >
            <span>💡 拍摄建议</span>
            <span style="font-size:12px;transition:transform 0.3s ease;" :style="{ transform: tipsExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }">▼</span>
          </div>
          <div class="tips-body" :class="{ collapsed: !tipsExpanded }">
            <div style="font-size:13px;color:var(--color-text-hint);line-height:1.8;">
              ✓ 叶片置于平整背景（如白纸）上拍摄<br>
              ✓ 确保叶片主体清晰、光线均匀<br>
              ✓ 一张图片只包含一种病害叶片<br>
              ✓ 避免强光直射或严重阴影
            </div>
          </div>
        </div>
      </div>
    `,
  };
};
