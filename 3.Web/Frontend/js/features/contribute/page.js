/**
 * 数据贡献页面
 * 用户上传标注图片，扩展训练数据集
 */
import { ref, reactive, computed } from 'vue';
import { useDiagnosisStore } from '../../stores/diagnosis.js';
import { useAdminStore } from '../../stores/admin.js';
import { useContributeStore } from '../../stores/contribute.js';
import { useUiStore } from '../../stores/ui.js';
import {
  getContributeList,
  getContributeStats,
  contributeSample,
  adminReview,
} from '../../api/index.js';
import AppLoading from '../../shared/components/AppLoading.js';
import AppEmpty from '../../shared/components/AppEmpty.js';
import AppIcon from '../../shared/components/AppIcon.js';
import PageHeader from '../../shared/components/PageHeader.js';

export default {
  name: 'PageContribute',
  components: { AppLoading, AppEmpty, AppIcon, PageHeader },
  setup() {
    const diagnosisStore = useDiagnosisStore();
    const admin = useAdminStore();
    const contributeStore = useContributeStore();
    const ui = useUiStore();

    const step = ref(0);                 // 当前步骤: 0=选模式, 1+=表单
    const mode = ref('extend');           // 'extend' | 'new'
    const images = ref([]);               // [{ file, previewUrl }]
    const selectedClass = ref('');
    const cropName = ref('');
    const diseaseName = ref('');
    const diseaseDesc = ref('');
    const location = ref('');
    const photoDate = ref('');
    const notes = ref('');
    const submitting = ref(false);
    const submitSuccess = ref(false);

    const filteredClasses = ref([]);
    const classSearch = ref('');
    const records = ref([]);
    const stats = ref(null);
    const recordsLoading = ref(true);
    const statsLoading = ref(true);

    const errors = reactive({});

    const recordFilter = ref('');          // '' | 'pending' | 'approved' | 'rejected'

    const reviewTarget = ref(null);
    const reviewAction = ref('');
    const reviewNotes = ref('');
    const reviewSubmitting = ref(false);

    const multiInput = ref(null);

    const classList = computed(() => contributeStore.state.classList);
    const isAdmin = computed(() => admin.state.loggedIn);

    const canSubmit = computed(() => {
      if (images.value.length === 0) return false;
      if (mode.value === 'extend') return !!selectedClass.value;
      if (mode.value === 'new') return !!(cropName.value.trim() && diseaseName.value.trim());
      return false;
    });

    const selectedClassLabel = computed(() => {
      const found = classList.value.find(c => c.en === selectedClass.value);
      return found ? (found.crop + ' · ' + found.cn) : '未选择';
    });

    const statusLabel = {
      pending: '审核中',
      approved: '已采纳',
      rejected: '未通过',
    };
    const statusIcon = {
      pending: 'clock',
      approved: 'check-circle',
      rejected: 'x-circle',
    };
    const modeLabel = {
      extend: '扩展类别',
      new: '新增病害',
    };

    // ── 数据加载 ──────────────────────────────────
    async function loadClasses() {
      await contributeStore.loadClasses();
      filteredClasses.value = classList.value;
    }

    async function loadRecords() {
      recordsLoading.value = true;
      try {
        records.value = (await getContributeList(recordFilter.value || '')) || [];
      } catch {
        records.value = [];
      } finally {
        recordsLoading.value = false;
      }
    }

    async function loadStats() {
      statsLoading.value = true;
      try {
        stats.value = await getContributeStats();
      } catch {
        stats.value = null;
      } finally {
        statsLoading.value = false;
      }
    }

    async function loadData() {
      await Promise.all([loadRecords(), loadStats()]);
    }

    // ── 类别搜索过滤 ──────────────────────────────
    function onClassSearch() {
      const q = classSearch.value.trim().toLowerCase();
      if (!q) {
        filteredClasses.value = classList.value;
        return;
      }
      filteredClasses.value = classList.value.filter(c =>
        c.cn.toLowerCase().includes(q) ||
        c.en.toLowerCase().includes(q) ||
        c.crop.toLowerCase().includes(q)
      );
    }

    // ── 步骤控制 ──────────────────────────────────
    function selectMode(m) {
      mode.value = m;
      Object.keys(errors).forEach(k => delete errors[k]);
      classSearch.value = '';
      filteredClasses.value = classList.value;
    }
    function goNext() { step.value = 1; }
    function goBack() { step.value = 0; }

    // ── 图片上传 ──────────────────────────────────
    function onAddImages(e) {
      const files = Array.from(e.target.files || []);
      for (const f of files) {
        if (!f.type.startsWith('image/')) {
          ui.showToast('仅支持图片格式', 'warning', 1500);
          continue;
        }
        if (f.size > 10 * 1024 * 1024) {
          ui.showToast('单张图片不能超过 10MB', 'warning', 1500);
          continue;
        }
        if (images.value.length >= 20) break;
        images.value.push({
          file: f,
          previewUrl: URL.createObjectURL(f),
        });
      }
      e.target.value = '';
    }
    function removeImage(idx) {
      URL.revokeObjectURL(images.value[idx].previewUrl);
      images.value.splice(idx, 1);
    }

    // ── 表单即时验证 ──────────────────────────────
    function validateField(field, value) {
      if (field === 'cropName' && mode.value === 'new') {
        errors.cropName = value.trim() ? '' : '请输入作物名称';
      }
      if (field === 'diseaseName' && mode.value === 'new') {
        errors.diseaseName = value.trim() ? '' : '请输入病害名称';
      }
      if (field === 'selectedClass' && mode.value === 'extend') {
        errors.selectedClass = value ? '' : '请选择病害类别';
      }
    }

    // ── 提交 ──────────────────────────────────────
    async function submit() {
      if (!canSubmit.value || submitting.value) return;
      submitting.value = true;
      submitSuccess.value = false;

      try {
        const fd = new FormData();
        fd.append('mode', mode.value);
        images.value.forEach(img => fd.append('files', img.file));
        if (mode.value === 'extend') fd.append('existing_class', selectedClass.value);
        if (mode.value === 'new') {
          fd.append('crop_name', cropName.value.trim());
          fd.append('disease_name', diseaseName.value.trim());
          fd.append('disease_description', diseaseDesc.value.trim());
        }
        if (location.value.trim()) fd.append('location', location.value.trim());
        if (photoDate.value) fd.append('photo_date', photoDate.value);
        if (notes.value.trim()) fd.append('notes', notes.value.trim());

        await contributeSample(fd);
        ui.showToast('提交成功，感谢您的贡献！', 'success');
        submitSuccess.value = true;

        loadData();

        setTimeout(() => {
          images.value.forEach(img => URL.revokeObjectURL(img.previewUrl));
          images.value = [];
          selectedClass.value = '';
          cropName.value = '';
          diseaseName.value = '';
          diseaseDesc.value = '';
          location.value = '';
          photoDate.value = '';
          notes.value = '';
          Object.keys(errors).forEach(k => delete errors[k]);
          classSearch.value = '';
          filteredClasses.value = classList.value;
          step.value = 0;
          submitSuccess.value = false;
        }, 1500);
      } catch (e) {
        ui.showToast(e.message || '提交失败', 'error');
        submitSuccess.value = false;
      } finally {
        submitting.value = false;
      }
    }

    // ── 记录筛选 ──────────────────────────────────
    function filterRecords(status) {
      recordFilter.value = recordFilter.value === status ? '' : status;
      loadRecords();
    }

    // ── 管理员审核 ──────────────────────────────
    function openReview(recordId, action) {
      reviewTarget.value = recordId;
      reviewAction.value = action;
      reviewNotes.value = '';
      reviewSubmitting.value = false;
    }
    function cancelReview() {
      reviewTarget.value = null;
      reviewAction.value = '';
      reviewNotes.value = '';
    }
    async function submitReview() {
      if (!reviewTarget.value || reviewSubmitting.value) return;
      reviewSubmitting.value = true;
      try {
        const approved = reviewAction.value === 'approve';
        await adminReview(reviewTarget.value, approved, reviewNotes.value.trim());
        ui.showToast(approved ? '已采纳该贡献' : '已驳回该贡献', 'success');
        cancelReview();
        await loadData();
      } catch (e) {
        ui.showToast(e.message || '审核失败', 'error');
      } finally {
        reviewSubmitting.value = false;
      }
    }

    // ── 初始化：如果从诊断页跳来，预填病害类别 ──
    if (diagnosisStore.state.status === 'done' && diagnosisStore.state.result) {
      mode.value = 'extend';
      selectedClass.value = diagnosisStore.state.result.top1.label_en;
    }
    loadClasses();
    loadData();

    return {
      step, mode, images, selectedClass, cropName, diseaseName, diseaseDesc,
      location, photoDate, notes, submitting, submitSuccess,
      filteredClasses, classSearch, records, stats, recordsLoading, statsLoading,
      errors, recordFilter, reviewTarget, reviewAction, reviewNotes, reviewSubmitting,
      multiInput, isAdmin, canSubmit, selectedClassLabel, statusLabel, statusIcon, modeLabel,
      selectMode, goNext, goBack, onAddImages, removeImage, validateField, submit,
      filterRecords, openReview, cancelReview, submitReview, onClassSearch,
    };
  },
  template: `
    <div>
      <page-header
        icon="upload"
        title="数据贡献"
        description="您的每一张标注图片，都能让 AI 识别更多病害"
      ></page-header>

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

      <!-- ═══ 步骤指示器 ═══ -->
      <div class="steps">
        <div class="step" :class="{ active: step === 0, done: step >= 1 }">1 · 选择贡献类型</div>
        <div class="step" :class="{ active: step >= 1 }">2 · 上传图片并提交</div>
      </div>

      <!-- ═══ 步骤 0：选择模式 ═══ -->
      <div v-if="step === 0">
        <div class="mode-cards">
          <div class="mode-card" :class="{ selected: mode === 'extend' }" @click="selectMode('extend')">
            <div class="mode-icon"><app-icon name="bar-chart" :size="30"></app-icon></div>
            <div class="mode-title">扩展已有类别</div>
            <div class="mode-desc">为现有 38 类病害补充更多真实场景样本</div>
          </div>
          <div class="mode-card" :class="{ selected: mode === 'new' }" @click="selectMode('new')">
            <div class="mode-icon"><app-icon name="sparkle" :size="30"></app-icon></div>
            <div class="mode-title">新增病害类型</div>
            <div class="mode-desc">提交训练数据中不存在的新病害</div>
          </div>
        </div>
        <button class="btn btn-primary btn-block" style="margin-top:20px;" @click="goNext">
          下一步 · 上传图片
        </button>
      </div>

      <!-- ═══ 步骤 1+：上传 + 标注 + 提交（两栏仪表盘布局） ═══ -->
      <div v-if="step >= 1">
        <!-- 返回选模式 -->
        <button class="btn btn-ghost btn-sm" style="margin-bottom:16px;" @click="goBack">重新选择模式</button>

        <div class="dashboard-grid">
          <div class="dashboard-main">
            <!-- 上传图片 -->
            <div class="card">
              <div class="card-header"><app-icon name="camera"></app-icon> 上传图片（{{ images.length }}/20）</div>
              <div class="image-grid">
                <div v-for="(img, idx) in images" :key="idx" class="image-grid-item">
                  <img :src="img.previewUrl" alt="" />
                  <button class="remove-btn" @click="removeImage(idx)"><app-icon name="x" :size="11"></app-icon></button>
                </div>
                <div class="image-grid-item add-slot" @click="multiInput?.click()" v-if="images.length < 20">
                  <app-icon name="upload" :size="22"></app-icon>
                </div>
              </div>
              <div style="font-size:12px;color:var(--color-text-muted, #999);margin-top:8px;">
                拖拽或点击上传，支持 JPG/PNG，单张 ≤10MB，最多 20 张
              </div>
              <input type="file" ref="multiInput" accept="image/*" multiple hidden @change="onAddImages" />
            </div>

            <!-- 标注表单 -->
            <div class="card">
              <div class="card-header"><app-icon name="file-text"></app-icon> 标注信息</div>

              <div v-if="mode === 'extend'">
                <div class="form-group">
                  <label class="form-label">选择病害类别</label>
                  <!-- 搜索输入框 -->
                  <input
                    class="form-input"
                    v-model="classSearch"
                    @input="onClassSearch"
                    placeholder="搜索病害（输入关键词过滤）..."
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
          </div>

          <!-- ═══ 侧栏：补充信息 + 提交摘要 ═══ -->
          <aside class="dashboard-aside">
            <div class="card">
              <div class="card-header"><app-icon name="paperclip"></app-icon> 补充信息 <span class="optional-tag">选填</span></div>
              <div class="form-group">
                <label class="form-label">拍摄地点</label>
                <input class="form-input" v-model="location" placeholder="例：北京昌平" />
              </div>
              <div class="form-group">
                <label class="form-label">拍摄时间</label>
                <input class="form-input" type="date" v-model="photoDate" />
              </div>
              <div class="form-group" style="margin-bottom:0;">
                <label class="form-label">备注说明</label>
                <input class="form-input" v-model="notes" placeholder="补充备注..." />
              </div>
            </div>

            <div class="card">
              <div class="card-header"><app-icon name="clipboard"></app-icon> 提交摘要</div>
              <div class="summary-row"><span>贡献类型</span><span class="sr-val">{{ modeLabel[mode] }}</span></div>
              <div class="summary-row"><span>图片数量</span><span class="sr-val">{{ images.length }} 张</span></div>
              <div class="summary-row" v-if="mode === 'extend'"><span>目标类别</span><span class="sr-val">{{ selectedClassLabel }}</span></div>
              <div class="summary-row" v-if="mode === 'new'"><span>病害名称</span><span class="sr-val">{{ diseaseName.trim() || '未填写' }}</span></div>

              <button
                class="btn btn-primary btn-block"
                :class="{ 'btn-submit-success': submitSuccess }"
                :disabled="!canSubmit || submitting"
                style="margin-top:14px;"
                @click="submit"
              >
                <app-icon v-if="!submitting" :name="submitSuccess ? 'check-circle' : 'upload'" :size="16"></app-icon>
                {{ submitting ? '提交中...' : (submitSuccess ? '提交成功！' : '提交贡献') }}
              </button>
            </div>
          </aside>
        </div>
      </div>

      <!-- ═══ 贡献记录 ═══ -->
      <div class="card" style="margin-top:32px;">
        <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
          <span style="display:flex;align-items:center;gap:8px;"><app-icon name="clipboard"></app-icon> 贡献记录</span>
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
            ><app-icon name="clock" :size="12"></app-icon> 审核中</button>
            <button
              class="btn btn-sm"
              :class="recordFilter === 'approved' ? 'btn-success' : 'btn-ghost'"
              @click="filterRecords('approved')"
            ><app-icon name="check-circle" :size="12"></app-icon> 已采纳</button>
            <button
              class="btn btn-sm"
              :class="recordFilter === 'rejected' ? 'btn-danger' : 'btn-ghost'"
              @click="filterRecords('rejected')"
            ><app-icon name="x-circle" :size="12"></app-icon> 未通过</button>
          </div>
        </div>

        <!-- 加载中 -->
        <app-loading v-if="recordsLoading" text="正在加载贡献记录..."></app-loading>

        <!-- 空状态 -->
        <app-empty
          v-else-if="!recordsLoading && records.length === 0"
          icon="upload"
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
                      <app-icon :name="statusIcon[r.status] || 'clock'" :size="11"></app-icon>
                      {{ statusLabel[r.status] || r.status }}
                    </span>
                    <div v-if="r.review_notes" class="review-note" :title="r.review_notes"><app-icon name="message" :size="14"></app-icon></div>

                    <!-- 管理员审核按钮（仅待审核状态显示） -->
                    <template v-if="isAdmin && r.status === 'pending' && reviewTarget !== r.id">
                      <button class="btn btn-sm btn-success" @click="openReview(r.id, 'approve')"><app-icon name="check-circle" :size="12"></app-icon> 采纳</button>
                      <button class="btn btn-sm btn-danger" @click="openReview(r.id, 'reject')"><app-icon name="x-circle" :size="12"></app-icon> 驳回</button>
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
                          <template v-if="!reviewSubmitting">
                            <app-icon :name="reviewAction === 'approve' ? 'check-circle' : 'x-circle'" :size="12"></app-icon>
                            {{ reviewAction === 'approve' ? '确认采纳' : '确认驳回' }}
                          </template>
                          <template v-else>...</template>
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
