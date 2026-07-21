/**
 * 数据贡献页面
 * 用户上传标注图片，扩展训练数据
 */
window.makePageContribute = function () {
  const store  = window.AppStore;
  const router = window.AppRouter;

  return {
    data() {
      return {
        step: 0,                        // 当前步骤
        mode: 'extend',                 // 'extend' | 'new'
        images: [],                     // [{ file, previewUrl }]
        selectedClass: '',
        cropName: '',
        diseaseName: '',
        diseaseDesc: '',
        location: '',
        photoDate: '',
        notes: '',
        submitting: false,
        submitSuccess: false,
        records: [],
        classList: [],
        errors: {},
      };
    },
    computed: {
      canSubmit() {
        if (this.images.length === 0) return false;
        if (this.mode === 'extend') return !!this.selectedClass;
        if (this.mode === 'new') return !!(this.cropName.trim() && this.diseaseName.trim());
        return false;
      },
    },
    created() {
      // 如果从诊断页跳来，预填
      if (store.diagnosis.status === 'done' && store.diagnosis.result) {
        this.mode = 'extend';
        this.selectedClass = store.diagnosis.result.top1.label_en;
      }
    },
    methods: {
      selectMode(m) { this.mode = m; this.errors = {}; this.$nextTick(() => { this.step = 1; }); },

      // 上传图片
      onAddImages(e) {
        const files = Array.from(e.target.files || []);
        for (const f of files) {
          if (!f.type.startsWith('image/')) {
            store.showToast('仅支持图片格式', 'warning', 1500);
            continue;
          }
          if (f.size > 10 * 1024 * 1024) {
            store.showToast('单张图片不能超过 10MB', 'warning', 1500);
            continue;
          }
          if (this.images.length >= 20) break;
          this.images.push({
            file: f,
            previewUrl: URL.createObjectURL(f),
          });
        }
        e.target.value = '';
      },
      removeImage(idx) {
        URL.revokeObjectURL(this.images[idx].previewUrl);
        this.images.splice(idx, 1);
      },

      // 表单即时验证
      validateField(field, value) {
        if (field === 'cropName' && this.mode === 'new') {
          this.errors.cropName = value.trim() ? '' : '请输入作物名称';
        }
        if (field === 'diseaseName' && this.mode === 'new') {
          this.errors.diseaseName = value.trim() ? '' : '请输入病害名称';
        }
        if (field === 'selectedClass' && this.mode === 'extend') {
          this.errors.selectedClass = value ? '' : '请选择病害类别';
        }
      },

      // 提交
      async submit() {
        if (!this.canSubmit || this.submitting) return;
        this.submitting = true;
        this.submitSuccess = false;

        try {
          const fd = new FormData();
          fd.append('mode', this.mode);
          this.images.forEach((img, i) => fd.append('files', img.file));
          if (this.mode === 'extend') fd.append('existing_class', this.selectedClass);
          if (this.mode === 'new') {
            fd.append('crop_name', this.cropName.trim());
            fd.append('disease_name', this.diseaseName.trim());
            fd.append('disease_description', this.diseaseDesc.trim());
          }
          if (this.location.trim()) fd.append('location', this.location.trim());
          if (this.photoDate) fd.append('photo_date', this.photoDate);
          if (this.notes.trim()) fd.append('notes', this.notes.trim());

          await window.Api.contributeSample(fd);
          store.showToast('提交成功，感谢您的贡献！', 'success');
          this.submitSuccess = true;

          // 延迟重置，让用户看到成功状态
          setTimeout(() => {
            this.images.forEach(img => URL.revokeObjectURL(img.previewUrl));
            this.images = [];
            this.selectedClass = '';
            this.cropName = '';
            this.diseaseName = '';
            this.diseaseDesc = '';
            this.location = '';
            this.photoDate = '';
            this.notes = '';
            this.errors = {};
            this.step = 0;
            this.submitSuccess = false;
          }, 1500);
        } catch (e) {
          store.showToast(e.message || '提交失败', 'error');
          this.submitSuccess = false;
        } finally {
          this.submitting = false;
        }
      },

      goDiagnose() { router.navigate('diagnose'); },
    },
    template: `
      <div>
        <div class="page-subtitle">您的每一张标注图片，都能让 AI 识别更多病害</div>

        <!-- 步骤 0：选择模式 -->
        <div v-if="step === 0">
          <div class="mode-cards">
            <div class="mode-card stagger-item" :style="{ '--i': 0 }" :class="{ selected: mode === 'extend' }" @click="selectMode('extend')">
              <div class="mode-icon">📊</div>
              <div class="mode-title">扩展已有类别</div>
              <div class="mode-desc">为现有 38 类病害补充更多真实场景样本</div>
            </div>
            <div class="mode-card stagger-item" :style="{ '--i': 1 }" :class="{ selected: mode === 'new' }" @click="selectMode('new')">
              <div class="mode-icon">✨</div>
              <div class="mode-title">新增病害类型</div>
              <div class="mode-desc">提交训练数据中不存在的新病害</div>
            </div>
          </div>
          <button class="btn btn-primary btn-block" style="margin-top:20px;" @click="step = 1">
            下一步 → 上传图片
          </button>
        </div>

        <!-- 步骤 1+：上传 + 标注 + 提交 -->
        <div v-if="step >= 1">
          <!-- 上传图片 -->
          <div class="card">
            <div class="card-header">📷 上传图片（{{ images.length }}/20）</div>
            <div class="image-grid">
              <div v-for="(img, idx) in images" :key="idx" class="image-grid-item">
                <img :src="img.previewUrl" alt="" />
                <button class="remove-btn" @click="removeImage(idx)">✕</button>
              </div>
              <div class="image-grid-item add-slot" @click="$refs.multiInput.click()" v-if="images.length < 20">
                +
              </div>
            </div>
            <div style="font-size:12px;color:#999;margin-top:8px;">
              拖拽或点击上传，支持 JPG/PNG，单张 ≤10MB，最多 20 张
            </div>
            <input type="file" ref="multiInput" accept="image/*" multiple hidden @change="onAddImages" />
          </div>

          <!-- 标注表单 -->
          <div class="card">
            <div class="card-header">📝 标注信息</div>

            <div v-if="mode === 'extend'">
              <div class="form-group">
                <label class="form-label">选择病害类别</label>
                <select class="form-select" :class="{ error: errors.selectedClass }" v-model="selectedClass" @change="validateField('selectedClass', selectedClass)">
                  <option value="">🔍 搜索或选择已有 38 类...</option>
                  <option v-for="c in classList" :key="c.en" :value="c.en">{{ c.crop }} — {{ c.cn }}</option>
                </select>
                <div v-if="errors.selectedClass" class="form-error-msg">{{ errors.selectedClass }}</div>
              </div>
            </div>

            <div v-if="mode === 'new'">
              <div class="form-group">
                <label class="form-label">作物名称 <span style="color:#999;">（必填）</span></label>
                <input class="form-input" :class="{ error: errors.cropName }" v-model="cropName" placeholder="例：水稻" @input="validateField('cropName', cropName)" />
                <div v-if="errors.cropName" class="form-error-msg">{{ errors.cropName }}</div>
              </div>
              <div class="form-group">
                <label class="form-label">病害名称 <span style="color:#999;">（必填）</span></label>
                <input class="form-input" :class="{ error: errors.diseaseName }" v-model="diseaseName" placeholder="例：稻瘟病" @input="validateField('diseaseName', diseaseName)" />
                <div v-if="errors.diseaseName" class="form-error-msg">{{ errors.diseaseName }}</div>
              </div>
              <div class="form-group">
                <label class="form-label">病害描述 <span style="color:#999;">（选填）</span></label>
                <textarea class="form-textarea" v-model="diseaseDesc" placeholder="帮助审核人员了解该病害的特征..."></textarea>
              </div>
            </div>
          </div>

          <!-- 补充信息 -->
          <div class="card">
            <div class="card-header">📎 补充信息 <span style="font-weight:400;font-size:13px;color:#999;">（选填）</span></div>
            <div class="form-group">
              <label class="form-label">拍摄地点</label>
              <input class="form-input" v-model="location" placeholder="例：北京昌平" />
            </div>
            <div class="form-group">
              <label class="form-label">拍摄时间</label>
              <input class="form-input" type="date" v-model="photoDate" />
            </div>
            <div class="form-group">
              <label class="form-label">备注说明</label>
              <input class="form-input" v-model="notes" placeholder="补充备注..." />
            </div>
          </div>

          <!-- 提交 -->
          <button
            class="btn btn-primary btn-block"
            :class="{ 'btn-submit-success': submitSuccess }"
            :disabled="!canSubmit || submitting"
            @click="submit"
          >
            {{ submitting ? '⏳ 提交中...' : (submitSuccess ? '✅ 提交成功！' : '📤 提交贡献') }}
          </button>
        </div>

        <!-- 贡献记录占位 -->
        <div class="card" style="margin-top:32px;">
          <div class="card-header">📋 我的贡献记录</div>
          <app-empty
            icon="📤"
            title="暂无贡献记录"
            description="上传您的第一份样本，帮助改进模型"
            action-label="开始贡献"
            @action="step = 0"
          ></app-empty>
        </div>
      </div>
    `,
  };
};
