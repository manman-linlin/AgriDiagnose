/**
 * 数据贡献页面
 * 用户上传标注图片，扩展训练数据集
 */
window.makePageContribute = function () {
  const store  = window.AppStore;
  const router = window.AppRouter;

  return {
    data() {
      return {
        step: 0,                        // 当前步骤: 0=选模式, 1+=表单
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

        // ── 从 API 加载的数据 ──
        classList: [],                  // 已有 38 类列表
        filteredClasses: [],            // 搜索过滤后的列表
        classSearch: '',                // 搜索关键字
        records: [],                    // 贡献记录
        stats: null,                    // 贡献统计 { total_submissions, total_images, ... }
        recordsLoading: true,
        statsLoading: true,

        // ── 表单验证 ──
        errors: {},

        // ── 记录筛选 ──
        recordFilter: '',               // 记录状态筛选: '' | 'pending' | 'approved' | 'rejected'

        // ── 管理员审核 ──
        reviewTarget: null,             // 正在审核的记录 ID
        reviewAction: '',               // 'approve' | 'reject'
        reviewNotes: '',                // 审核备注
        reviewSubmitting: false,
      };
    },

    computed: {
      canSubmit() {
        if (this.images.length === 0) return false;
        if (this.mode === 'extend') return !!this.selectedClass;
        if (this.mode === 'new') return !!(this.cropName.trim() && this.diseaseName.trim());
        return false;
      },
      isAdmin() { return store.admin.loggedIn; },
      /** 状态文本映射 */
      statusLabel() {
        return {
          pending: '⏳ 审核中',
          approved: '✅ 已采纳',
          rejected: '❌ 未通过',
        };
      },
      /** 模式文本映射 */
      modeLabel() {
        return {
          extend: '扩展类别',
          new: '新增病害',
        };
      },
    },

    created() {
      // 如果从诊断页跳来，预填病害类别
      if (store.diagnosis.status === 'done' && store.diagnosis.result) {
        this.mode = 'extend';
        this.selectedClass = store.diagnosis.result.top1.label_en;
      }
      // 异步加载数据
      this.loadClasses();
      this.loadData();
    },

    methods: {
      // ── 数据加载 ──────────────────────────────────
      async loadClasses() {
        try {
          const data = await window.Api.getContributeClasses();
          this.classList = data || [];
          this.filteredClasses = this.classList;
        } catch {
          // 静默失败，下拉框显示为空
        }
      },

      async loadData() {
        await Promise.all([this.loadRecords(), this.loadStats()]);
      },

      async loadRecords() {
        this.recordsLoading = true;
        try {
          const status = this.recordFilter || '';
          const data = await window.Api.getContributeList(status);
          this.records = data || [];
        } catch {
          this.records = [];
        } finally {
          this.recordsLoading = false;
        }
      },

      async loadStats() {
        this.statsLoading = true;
        try {
          this.stats = await window.Api.getContributeStats();
        } catch {
          this.stats = null;
        } finally {
          this.statsLoading = false;
        }
      },

      // ── 类别搜索过滤 ──────────────────────────────
      onClassSearch() {
        const q = this.classSearch.trim().toLowerCase();
        if (!q) {
          this.filteredClasses = this.classList;
          return;
        }
        this.filteredClasses = this.classList.filter(c =>
          c.cn.toLowerCase().includes(q) ||
          c.en.toLowerCase().includes(q) ||
          c.crop.toLowerCase().includes(q)
        );
      },

      // ── 步骤控制 ──────────────────────────────────
      selectMode(m) {
        this.mode = m;
        this.errors = {};
        this.classSearch = '';
        this.filteredClasses = this.classList;
      },
      goNext() {
        this.step = 1;
      },
      goBack() { this.step = 0; },

      // ── 图片上传 ──────────────────────────────────
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

      // ── 表单即时验证 ──────────────────────────────
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

      // ── 提交 ──────────────────────────────────────
      async submit() {
        if (!this.canSubmit || this.submitting) return;
        this.submitting = true;
        this.submitSuccess = false;

        try {
          const fd = new FormData();
          fd.append('mode', this.mode);
          this.images.forEach(img => fd.append('files', img.file));
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

          // 刷新记录和统计
          this.loadData();

          // 延迟重置表单
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
            this.classSearch = '';
            this.filteredClasses = this.classList;
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

      // ── 记录筛选 ──────────────────────────────────
      filterRecords(status) {
        this.recordFilter = this.recordFilter === status ? '' : status;
        this.loadRecords();
      },

      // ── 管理员审核 ──────────────────────────────
      openReview(recordId, action) {
        this.reviewTarget = recordId;
        this.reviewAction = action;
        this.reviewNotes = '';
        this.reviewSubmitting = false;
      },
      cancelReview() {
        this.reviewTarget = null;
        this.reviewAction = '';
        this.reviewNotes = '';
      },
      async submitReview() {
        if (!this.reviewTarget || this.reviewSubmitting) return;
        this.reviewSubmitting = true;
        try {
          const approved = this.reviewAction === 'approve';
          await window.Api.adminReview(this.reviewTarget, approved, this.reviewNotes.trim());
          store.showToast(approved ? '已采纳该贡献' : '已驳回该贡献', 'success');
          this.cancelReview();
          // 刷新记录
          await this.loadData();
        } catch (e) {
          store.showToast(e.message || '审核失败', 'error');
        } finally {
          this.reviewSubmitting = false;
        }
      },

      // ── 导航 ──────────────────────────────────────
      goDiagnose() { router.navigate('diagnose'); },
    },

    template: `
      <div>
        <div class="page-subtitle">您的每一张标注图片，都能让 AI 识别更多病害</div>

        <!-- ═══ 统计卡片 ═══ -->
        <div class="stats-mini-row" v-if="stats">
          <div class="stats-mini-card stagger-item" :style="{ '--i': 0 }">
            <div class="stats-mini-num">{{ stats.total_submissions }}</div>
            <div class="stats-mini-label">总提交</div>
          </div>
          <div class="stats-mini-card stagger-item" :style="{ '--i': 1 }">
            <div class="stats-mini-num">{{ stats.total_images }}</div>
            <div class="stats-mini-label">总图片</div>
          </div>
          <div class="stats-mini-card stagger-item" :style="{ '--i': 2 }">
            <div class="stats-mini-num">{{ stats.pending_count }}</div>
            <div class="stats-mini-label">待审核</div>
          </div>
          <div class="stats-mini-card stagger-item" :style="{ '--i': 3 }">
            <div class="stats-mini-num">{{ stats.approved_images }}</div>
            <div class="stats-mini-label">已采纳图片</div>
          </div>
        </div>

        <!-- ═══ 步骤 0：选择模式 ═══ -->
        <div v-if="step === 0">
          <div class="mode-cards">
            <div class="mode-card" :class="{ selected: mode === 'extend' }" @click="selectMode('extend')">
              <div class="mode-icon">📊</div>
              <div class="mode-title">扩展已有类别</div>
              <div class="mode-desc">为现有 38 类病害补充更多真实场景样本</div>
            </div>
            <div class="mode-card" :class="{ selected: mode === 'new' }" @click="selectMode('new')">
              <div class="mode-icon">✨</div>
              <div class="mode-title">新增病害类型</div>
              <div class="mode-desc">提交训练数据中不存在的新病害</div>
            </div>
          </div>
          <button class="btn btn-primary btn-block" style="margin-top:20px;" @click="goNext">
            下一步 → 上传图片
          </button>
        </div>

        <!-- ═══ 步骤 1+：上传 + 标注 + 提交 ═══ -->
        <div v-if="step >= 1">
          <!-- 返回选模式 -->
          <button class="btn btn-ghost btn-sm" style="margin-bottom:16px;" @click="goBack">← 重新选择模式</button>

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
            <div style="font-size:12px;color:var(--color-text-muted, #999);margin-top:8px;">
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
                <!-- 搜索输入框 -->
                <input
                  class="form-input"
                  v-model="classSearch"
                  @input="onClassSearch"
                  placeholder="🔍 搜索病害（输入关键词过滤）..."
                  style="margin-bottom:8px;"
                />
                <select
                  class="form-select"
                  :class="{ error: errors.selectedClass }"
                  v-model="selectedClass"
                  @change="validateField('selectedClass', selectedClass)"
                  size="8"
                >
                  <option value="">— 请选择病害类别 —</option>
                  <option v-for="c in filteredClasses" :key="c.en" :value="c.en">
                    {{ c.crop }} — {{ c.cn }}
                  </option>
                </select>
                <div v-if="errors.selectedClass" class="form-error-msg">{{ errors.selectedClass }}</div>
                <div style="font-size:12px;color:var(--color-text-muted, #999);margin-top:4px;">
                  共 {{ filteredClasses.length }} 个匹配类别
                </div>
              </div>
            </div>

            <div v-if="mode === 'new'">
              <div class="form-group">
                <label class="form-label">作物名称 <span style="color:var(--color-text-muted, #999);">（必填）</span></label>
                <input class="form-input" :class="{ error: errors.cropName }" v-model="cropName" placeholder="例：水稻" @input="validateField('cropName', cropName)" />
                <div v-if="errors.cropName" class="form-error-msg">{{ errors.cropName }}</div>
              </div>
              <div class="form-group">
                <label class="form-label">病害名称 <span style="color:var(--color-text-muted, #999);">（必填）</span></label>
                <input class="form-input" :class="{ error: errors.diseaseName }" v-model="diseaseName" placeholder="例：稻瘟病" @input="validateField('diseaseName', diseaseName)" />
                <div v-if="errors.diseaseName" class="form-error-msg">{{ errors.diseaseName }}</div>
              </div>
              <div class="form-group">
                <label class="form-label">病害描述 <span style="color:var(--color-text-muted, #999);">（选填）</span></label>
                <textarea class="form-textarea" v-model="diseaseDesc" placeholder="帮助审核人员了解该病害的特征..." rows="3"></textarea>
              </div>
            </div>
          </div>

          <!-- 补充信息 -->
          <div class="card">
            <div class="card-header">📎 补充信息 <span style="font-weight:400;font-size:13px;color:var(--color-text-muted, #999);">（选填）</span></div>
            <div class="form-row">
              <div class="form-group" style="flex:1;">
                <label class="form-label">拍摄地点</label>
                <input class="form-input" v-model="location" placeholder="例：北京昌平" />
              </div>
              <div class="form-group" style="flex:1;">
                <label class="form-label">拍摄时间</label>
                <input class="form-input" type="date" v-model="photoDate" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">备注说明</label>
              <input class="form-input" v-model="notes" placeholder="补充备注..." />
            </div>
          </div>

          <!-- 提交按钮 -->
          <button
            class="btn btn-primary btn-block"
            :class="{ 'btn-submit-success': submitSuccess }"
            :disabled="!canSubmit || submitting"
            @click="submit"
          >
            {{ submitting ? '⏳ 提交中...' : (submitSuccess ? '✅ 提交成功！' : '📤 提交贡献') }}
          </button>
        </div>

        <!-- ═══ 贡献记录 ═══ -->
        <div class="card" style="margin-top:32px;">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <span>📋 贡献记录</span>
            <!-- 状态筛选按钮组 -->
            <div class="filter-btn-group">
              <button
                class="btn btn-sm"
                :class="recordFilter === '' ? 'btn-primary' : 'btn-ghost'"
                @click="filterRecords('')"
              >全部</button>
              <button
                class="btn btn-sm"
                :class="recordFilter === 'pending' ? 'btn-warning' : 'btn-ghost'"
                @click="filterRecords('pending')"
              >⏳ 审核中</button>
              <button
                class="btn btn-sm"
                :class="recordFilter === 'approved' ? 'btn-success' : 'btn-ghost'"
                @click="filterRecords('approved')"
              >✅ 已采纳</button>
              <button
                class="btn btn-sm"
                :class="recordFilter === 'rejected' ? 'btn-danger' : 'btn-ghost'"
                @click="filterRecords('rejected')"
              >❌ 未通过</button>
            </div>
          </div>

          <!-- 加载中 -->
          <app-loading v-if="recordsLoading" message="正在加载贡献记录..."></app-loading>

          <!-- 空状态 -->
          <app-empty
            v-else-if="!recordsLoading && records.length === 0"
            icon="📤"
            :title="recordFilter ? '暂无符合筛选条件的记录' : '暂无贡献记录'"
            :description="recordFilter ? '尝试切换其他筛选条件' : '上传您的第一份样本，帮助改进模型'"
            :action-label="recordFilter ? '' : '开始贡献'"
            @action="step = 0"
          ></app-empty>

          <!-- 记录表格 -->
          <div v-else class="table-wrapper">
            <table class="data-table">
              <thead>
                <tr>
                  <th>提交时间</th>
                  <th>模式</th>
                  <th>病害</th>
                  <th>图片数</th>
                  <th>状态</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="r in records" :key="r.id">
                  <td class="td-time">{{ r.submit_time }}</td>
                  <td>
                    <span class="tag" :class="'tag-' + r.mode">{{ modeLabel[r.mode] || r.mode }}</span>
                  </td>
                  <td>
                    <template v-if="r.mode === 'extend'">
                      <span class="disease-tag">{{ r.existing_class?.split('___')?.[1]?.replace(/_/g, ' ') || r.existing_class }}</span>
                    </template>
                    <template v-else>
                      {{ r.crop_name }} — {{ r.disease_name }}
                    </template>
                  </td>
                  <td>{{ r.image_count }} 张</td>
                  <td>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                      <span class="status-badge" :class="'status-' + r.status">
                        {{ statusLabel[r.status] || r.status }}
                      </span>
                      <div v-if="r.review_notes" class="review-note" :title="r.review_notes">💬</div>

                      <!-- 管理员审核按钮（仅待审核状态显示） -->
                      <template v-if="isAdmin && r.status === 'pending' && reviewTarget !== r.id">
                        <button class="btn btn-sm btn-success" @click="openReview(r.id, 'approve')">✅ 采纳</button>
                        <button class="btn btn-sm btn-danger" @click="openReview(r.id, 'reject')">❌ 驳回</button>
                      </template>

                      <!-- 审核表单（点击后展开） -->
                      <div v-if="reviewTarget === r.id" class="review-form-inline">
                        <textarea
                          class="form-textarea"
                          v-model="reviewNotes"
                          placeholder="审核备注（选填）..."
                          rows="2"
                          style="min-height:48px;font-size:12px;"
                        ></textarea>
                        <div style="display:flex;gap:6px;margin-top:6px;">
                          <button
                            class="btn btn-sm"
                            :class="reviewAction === 'approve' ? 'btn-success' : 'btn-danger'"
                            :disabled="reviewSubmitting"
                            @click="submitReview"
                          >
                            {{ reviewSubmitting ? '...' : (reviewAction === 'approve' ? '✅ 确认采纳' : '❌ 确认驳回') }}
                          </button>
                          <button class="btn btn-sm btn-ghost" @click="cancelReview" :disabled="reviewSubmitting">取消</button>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `,
  };
};
