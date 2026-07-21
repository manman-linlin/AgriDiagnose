/** 图片上传 + 预览组件 — 优化版：拖拽脉冲、验证反馈、预览过渡 */
window.makeAppImageUploader = function () {
  return {
    props: {
      previewUrl: { type: String, default: null },
      disabled:   { type: Boolean, default: false },
      hint:       { type: String, default: '支持 JPG / PNG，单张 ≤ 10MB，建议叶片主体清晰' },
    },
    emits: ['file-change', 'clear'],
    data() {
      return {
        dragging: false,
        validationError: '',
      };
    },
    methods: {
      handleClick() {
        if (this.disabled) return;
        this.validationError = '';
        this.$refs.fileInput.click();
      },
      validateFile(file) {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
          return '仅支持 JPG / PNG / WebP 格式';
        }
        if (file.size > 10 * 1024 * 1024) {
          return '图片大小不能超过 10MB';
        }
        return '';
      },
      handleFile(e) {
        const file = e.target.files[0];
        if (!file) return;
        const err = this.validateFile(file);
        if (err) {
          this.validationError = err;
          e.target.value = '';
          return;
        }
        this.validationError = '';
        this.$emit('file-change', file);
        e.target.value = '';  // 允许重复选同文件
      },
      handleDrop(e) {
        this.dragging = false;
        const file = e.dataTransfer.files[0];
        if (!file) return;
        const err = this.validateFile(file);
        if (err) {
          this.validationError = err;
          return;
        }
        this.validationError = '';
        this.$emit('file-change', file);
      },
      clearPreview() {
        this.validationError = '';
        this.$emit('clear');
      },
    },
    template: `
      <div
        class="upload-zone"
        :class="{
          dragover: dragging,
          'validation-error': !!validationError
        }"
        @click="handleClick"
        @dragover.prevent="dragging = true"
        @dragleave.prevent="dragging = false"
        @drop.prevent="handleDrop"
      >
        <!-- 无预览：上传引导 -->
        <div v-if="!previewUrl">
          <span class="upload-icon">🍃</span>
          <div class="upload-text">点击上传或拖拽图片到此处</div>
          <div class="upload-hint">{{ hint }}</div>
          <div class="validation-msg">{{ validationError }}</div>
        </div>

        <!-- 有预览：图片 + 清除按钮 -->
        <div v-else class="upload-preview-wrap" style="position:relative;">
          <img class="upload-preview" :src="previewUrl" alt="叶片预览" />
          <button
            class="remove-btn"
            style="position:absolute;top:8px;right:8px;width:28px;height:28px;border:none;border-radius:50%;background:rgba(0,0,0,0.5);color:#fff;font-size:14px;cursor:pointer;display:flex;align-items:center;justify-content:center;"
            @click.stop="clearPreview"
          >✕</button>
        </div>

        <input
          type="file"
          ref="fileInput"
          accept="image/jpeg,image/png,image/webp"
          hidden
          @change="handleFile"
        />
      </div>
    `,
  };
};
