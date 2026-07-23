import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import {
  adminModelInfo,
  adminModelClasses,
  adminModelDevices,
  adminModelTrain,
  adminModelTrainingStatus,
  adminModelTrainingCancel,
  getContributeStats,
} from '../../../api/index.js?v=2';
import { useUiStore } from '../../../stores/ui.js';
import PageHeader from '../../../shared/components/PageHeader.js';
import AppIcon from '../../../shared/components/AppIcon.js';
import AppLoading from '../../../shared/components/AppLoading.js';

const FALLBACK_INFO = {
  name: 'ConvNeXt-Tiny',
  architecture: 'ConvNeXt-Tiny',
  framework: 'PyTorch + timm',
  dataset: 'PlantVillage color',
  accuracy: '99.80%',
  classes: 38,
  imageSize: 224,
  size: '111.5 MB',
  lastTrain: '-',
  epochs: 20,
  bestEpoch: 19,
  description: '基于叶片图像的 38 类农作物病虫害分类模型，适合课程设计演示和标准数据集验证。',
};

const EMPTY_TRAINING = {
  status: 'idle',
  progress: 0,
  epoch: 0,
  totalEpochs: 20,
  loss: 0,
  acc: 0,
  logs: [],
  message: '',
};

const FALLBACK_DEVICES = [
  {
    id: 'auto',
    type: 'auto',
    name: '自动选择',
    model: 'GPU / CPU',
    index: null,
    memory: '',
    description: '优先使用可用 GPU，没有 GPU 时自动回退到 CPU。',
    recommended: true,
  },
  {
    id: 'cpu',
    type: 'cpu',
    name: 'CPU',
    model: '本机 CPU',
    index: -1,
    memory: '',
    description: '兼容性最好，但完整训练耗时较长。',
    recommended: false,
  },
];

export default {
  name: 'AdminModel',
  components: { PageHeader, AppIcon, AppLoading },
  setup() {
    const ui = useUiStore();
    const loading = ref(true);
    const info = ref({ ...FALLBACK_INFO });
    const devices = ref([]);
    const classList = ref([]);
    const classError = ref('');
    const contributionStats = ref({ approved_images: 0, pending_count: 0, total_images: 0 });
    const classCropFilter = ref('');
    const showTrainConfirm = ref(false);
    const training = ref({ ...EMPTY_TRAINING });
    const trainParams = ref({
      epochs: 20,
      batchSize: 16,
      lr: 0.0003,
      device: 'auto',
      includeContributed: true,
      contributedStatus: 'approved',
    });
    let pollTimer = null;

    const isRunning = computed(() => training.value.status === 'running');
    const statusText = computed(() => ({
      idle: '空闲',
      running: '训练中',
      done: '已完成',
      error: '异常',
      cancelled: '已取消',
    }[training.value.status] || '空闲'));
    const progress = computed(() => Math.max(0, Math.min(100, Number(training.value.progress || 0))));
    const selectedDevice = computed(() => devices.value.find(d => d.id === trainParams.value.device) || devices.value[0] || null);
    const trainableDeviceCount = computed(() => devices.value.filter(d => d.id !== 'auto').length);
    const bestClassCount = computed(() => classList.value.filter(c => Number(c.accuracy || 0) >= 99).length);
    const weakClassCount = computed(() => classList.value.filter(c => Number(c.accuracy || 0) > 0 && Number(c.accuracy || 0) < 95).length);

    const classCrops = computed(() => [...new Set(classList.value.map(c => c.crop).filter(Boolean))].sort());
    const classCropSummary = computed(() => {
      const groups = {};
      classList.value.forEach(c => {
        const crop = c.crop || '其他';
        if (!groups[crop]) groups[crop] = [];
        groups[crop].push(c);
      });
      return Object.entries(groups).map(([crop, items]) => {
        const accuracies = items.map(c => Number(c.accuracy || 0)).filter(Boolean);
        const avg = accuracies.length
          ? accuracies.reduce((sum, acc) => sum + acc, 0) / accuracies.length
          : 0;
        const weak = items.filter(c => Number(c.accuracy || 0) > 0 && Number(c.accuracy || 0) < 95).length;
        const strong = items.filter(c => Number(c.accuracy || 0) >= 99).length;
        return { crop, total: items.length, avg, weak, strong };
      }).sort((a, b) => b.weak - a.weak || a.avg - b.avg || a.crop.localeCompare(b.crop));
    });
    const focusClasses = computed(() => {
      if (classCropFilter.value) {
        return classList.value
          .filter(c => c.crop === classCropFilter.value)
          .sort((a, b) => Number(a.accuracy || 0) - Number(b.accuracy || 0));
      }
      const weak = classList.value.filter(c => Number(c.accuracy || 0) > 0 && Number(c.accuracy || 0) < 95);
      const source = weak.length ? weak : classList.value;
      return [...source]
        .sort((a, b) => Number(a.accuracy || 0) - Number(b.accuracy || 0))
        .slice(0, 12);
    });
    const classFocusTitle = computed(() => {
      if (classCropFilter.value) return `${classCropFilter.value} 类别明细`;
      return weakClassCount.value ? '待关注类别' : '相对低表现类别';
    });
    const groupedClasses = computed(() => {
      const groups = {};
      const list = classCropFilter.value
        ? classList.value.filter(c => c.crop === classCropFilter.value)
        : classList.value;
      list.forEach(c => {
        const crop = c.crop || '其他';
        if (!groups[crop]) groups[crop] = [];
        groups[crop].push(c);
      });
      return groups;
    });

    function normalizeDevices(list) {
      const source = Array.isArray(list) && list.length ? list : FALLBACK_DEVICES;
      const hasAuto = source.some(d => d.id === 'auto');
      const hasCpu = source.some(d => d.id === 'cpu' || d.type === 'cpu');
      const normalized = source.map(d => ({
        id: d.id || (d.type === 'cuda' ? `cuda:${d.index}` : d.type || 'cpu'),
        type: d.type || 'cpu',
        name: d.name || 'CPU',
        model: d.model || d.name || 'CPU',
        index: d.index,
        memory: d.memory || '',
        description: d.description || (d.type === 'cuda' ? 'GPU 加速训练，适合完整训练任务。' : '兼容性最好，但完整训练耗时较长。'),
        recommended: Boolean(d.recommended),
      }));
      if (!hasAuto) {
        normalized.unshift({
          id: 'auto',
          type: 'auto',
          name: '自动选择',
          model: 'GPU / CPU',
          index: null,
          memory: '',
          description: '优先使用可用 GPU，没有 GPU 时自动回退到 CPU。',
          recommended: true,
        });
      }
      if (!hasCpu) {
        normalized.push({ ...FALLBACK_DEVICES[1] });
      }
      return normalized;
    }

    async function load() {
      loading.value = true;
      try {
        const [modelInfo, deviceList, classes, stats] = await Promise.allSettled([
          adminModelInfo(),
          adminModelDevices(),
          adminModelClasses(),
          getContributeStats(),
        ]);
        info.value = modelInfo.status === 'fulfilled' ? { ...FALLBACK_INFO, ...modelInfo.value } : { ...FALLBACK_INFO };
        devices.value = normalizeDevices(deviceList.status === 'fulfilled' ? deviceList.value : []);
        if (classes.status === 'fulfilled') {
          classList.value = classes.value;
          classError.value = '';
        } else {
          classList.value = [];
          classError.value = classes.reason?.message || '未知错误';
          console.error('[AdminModel] 类别数据加载失败:', classes.reason);
        }
        contributionStats.value = stats.status === 'fulfilled'
          ? { ...contributionStats.value, ...stats.value }
          : contributionStats.value;
        if (!devices.value.some(d => d.id === trainParams.value.device)) {
          trainParams.value.device = devices.value[0]?.id || 'auto';
        }
        await refreshTrainingStatus(false);
      } finally {
        loading.value = false;
      }
    }

    async function refreshTrainingStatus(showErrors = false) {
      try {
        const s = await adminModelTrainingStatus();
        training.value = { ...EMPTY_TRAINING, ...s };
        if (training.value.status === 'running') startPolling();
      } catch (e) {
        if (showErrors) ui.showToast(e.message || '获取训练状态失败', 'error');
      }
    }

    function startPolling() {
      if (pollTimer) return;
      pollTimer = setInterval(async () => {
        try {
          const s = await adminModelTrainingStatus();
          training.value = { ...EMPTY_TRAINING, ...s };
          if (['done', 'error', 'cancelled', 'idle'].includes(training.value.status)) {
            stopPolling();
            if (training.value.status === 'done') {
              ui.showToast('模型训练完成', 'success');
              load();
            } else if (training.value.status === 'error') {
              ui.showToast(training.value.message || '模型训练异常', 'error');
            }
          }
        } catch {}
      }, 3000);
    }

    function stopPolling() {
      if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
      }
    }

    function askStartTrain() {
      showTrainConfirm.value = true;
    }

    function cancelTrainDialog() {
      showTrainConfirm.value = false;
    }

    async function startTrain() {
      showTrainConfirm.value = false;
      try {
        await adminModelTrain(trainParams.value);
        training.value = {
          ...EMPTY_TRAINING,
          status: 'running',
          totalEpochs: trainParams.value.epochs,
          device: trainParams.value.device,
          message: '训练已启动',
        };
        ui.showToast('训练任务已启动', 'info');
        startPolling();
      } catch (e) {
        ui.showToast(e.message || '启动训练失败', 'error');
      }
    }

    async function cancelTraining() {
      try {
        await adminModelTrainingCancel();
        await refreshTrainingStatus();
        stopPolling();
        ui.showToast('训练任务已取消', 'warning');
      } catch (e) {
        ui.showToast(e.message || '取消训练失败', 'error');
      }
    }

    function accuracyClass(acc) {
      const n = Number(acc || 0);
      if (n >= 99) return 'tag-status-approved';
      if (n >= 95) return 'tag-category';
      if (n > 0) return 'tag-status-pending';
      return 'tag-status-rejected';
    }

    function formatAcc(acc) {
      const n = Number(acc || 0);
      return n ? `${n.toFixed(1)}%` : '-';
    }

    function accWidth(acc) {
      const n = Number(acc || 0);
      return `${Math.max(4, Math.min(100, n))}%`;
    }

    function selectCrop(crop) {
      classCropFilter.value = classCropFilter.value === crop ? '' : crop;
    }

    onMounted(load);
    onBeforeUnmount(stopPolling);

    return {
      loading,
      info,
      devices,
      classList,
      classError,
      contributionStats,
      classCropFilter,
      classCrops,
      classCropSummary,
      focusClasses,
      classFocusTitle,
      groupedClasses,
      training,
      trainParams,
      showTrainConfirm,
      isRunning,
      statusText,
      progress,
      selectedDevice,
      trainableDeviceCount,
      bestClassCount,
      weakClassCount,
      load,
      askStartTrain,
      cancelTrainDialog,
      startTrain,
      cancelTraining,
      refreshTrainingStatus,
      accuracyClass,
      formatAcc,
      accWidth,
      selectCrop,
    };
  },
  template: `
    <div>
      <page-header
        icon="cpu"
        title="模型管理"
        description="查看当前识别模型概况，选择训练设备，并在后台启动一次完整训练。"
      >
        <button class="btn btn-outline" @click="load" :disabled="loading || isRunning">
          <app-icon name="refresh-cw" :size="16"></app-icon> 刷新
        </button>
        <button class="btn btn-primary" @click="askStartTrain" :disabled="isRunning">
          <app-icon name="play" :size="16"></app-icon> 一键训练
        </button>
      </page-header>

      <app-loading v-if="loading" text="加载模型信息..."></app-loading>

      <div v-else class="model-admin-page">
        <div class="stats-mini-row">
          <div class="stats-mini-card">
            <div class="stats-mini-num">{{ info.accuracy }}</div>
            <div class="stats-mini-label">最佳验证准确率</div>
          </div>
          <div class="stats-mini-card">
            <div class="stats-mini-num">{{ info.classes }}</div>
            <div class="stats-mini-label">识别类别</div>
          </div>
          <div class="stats-mini-card">
            <div class="stats-mini-num">{{ info.size }}</div>
            <div class="stats-mini-label">权重文件</div>
          </div>
          <div class="stats-mini-card">
            <div class="stats-mini-num">{{ statusText }}</div>
            <div class="stats-mini-label">训练状态</div>
          </div>
        </div>

        <div class="dashboard-grid model-grid">
          <section class="dashboard-main">
            <div class="card">
              <div class="card-header">
                <app-icon name="bar-chart" :size="16"></app-icon> 模型概况
              </div>
              <p class="model-desc">{{ info.description }}</p>
              <div class="model-meta-grid">
                <div class="summary-row"><span>模型架构</span><span class="sr-val">{{ info.architecture || info.name }}</span></div>
                <div class="summary-row"><span>训练框架</span><span class="sr-val">{{ info.framework }}</span></div>
                <div class="summary-row"><span>数据来源</span><span class="sr-val">{{ info.dataset }}</span></div>
                <div class="summary-row"><span>输入尺寸</span><span class="sr-val">{{ info.imageSize }} x {{ info.imageSize }}</span></div>
                <div class="summary-row"><span>历史轮数</span><span class="sr-val">{{ info.epochs }} Epoch</span></div>
                <div class="summary-row"><span>最佳轮次</span><span class="sr-val">{{ info.bestEpoch ? 'Epoch ' + info.bestEpoch : '-' }}</span></div>
                <div class="summary-row"><span>最后训练</span><span class="sr-val">{{ info.lastTrain }}</span></div>
                <div class="summary-row"><span>高表现类别</span><span class="sr-val">{{ bestClassCount }} 类</span></div>
              </div>
            </div>

            <div class="card">
              <div class="card-header">
                <app-icon name="play" :size="16"></app-icon> 训练控制
              </div>
              <div class="form-row">
                <div class="form-group">
                  <label class="form-label">训练轮数</label>
                  <input class="form-input" type="number" v-model.number="trainParams.epochs" min="1" max="100" :disabled="isRunning" />
                </div>
                <div class="form-group">
                  <label class="form-label">批大小</label>
                  <input class="form-input" type="number" v-model.number="trainParams.batchSize" min="1" max="128" :disabled="isRunning" />
                </div>
                <div class="form-group">
                  <label class="form-label">学习率</label>
                  <input class="form-input" type="number" v-model.number="trainParams.lr" step="0.0001" min="0.00001" max="0.1" :disabled="isRunning" />
                </div>
              </div>

              <label class="train-merge-option">
                <input type="checkbox" v-model="trainParams.includeContributed" :disabled="isRunning" />
                <span>
                  <strong>合并贡献数据训练</strong>
                  <small>
                    将后台审核通过的数据贡献样本与原有 PlantVillage 训练集一起参与训练，生成新的模型权重。
                    当前已采纳 {{ contributionStats.approved_images || 0 }} 张，待审核 {{ contributionStats.pending_count || 0 }} 条。
                  </small>
                </span>
              </label>

              <div class="train-device-section">
                <div class="train-device-head">
                  <span><app-icon name="server" :size="16"></app-icon> 可训练设备</span>
                  <small>{{ trainableDeviceCount }} 台可训练设备</small>
                </div>
                <label class="mode-card train-device-card"
                  v-for="d in devices"
                  :key="d.id"
                  :class="{ selected: trainParams.device === d.id }"
                >
                  <input type="radio" v-model="trainParams.device" :value="d.id" :disabled="isRunning" />
                  <span class="mode-icon">
                    <app-icon :name="d.type === 'cuda' ? 'cpu' : d.type === 'auto' ? 'sparkle' : 'server'" :size="24"></app-icon>
                  </span>
                  <span class="mode-title">{{ d.name }}</span>
                  <span class="device-model-line">型号：{{ d.model }}</span>
                  <span class="mode-desc">{{ d.description }}</span>
                  <span class="tag tag-sm tag-crop" v-if="d.memory">{{ d.memory }}</span>
                  <span class="tag tag-sm tag-status-approved" v-if="d.recommended">推荐</span>
                </label>
              </div>

              <div class="train-action-row">
                <button class="btn btn-primary" :disabled="isRunning" @click="askStartTrain">
                  <app-icon name="play" :size="16"></app-icon> 一键训练
                </button>
                <button class="btn btn-outline" v-if="isRunning" @click="cancelTraining">
                  <app-icon name="x-circle" :size="16"></app-icon> 取消训练
                </button>
                <span class="page-subtitle" style="margin:0;">
                  当前设备：{{ selectedDevice?.name || '自动选择' }}
                </span>
              </div>
            </div>

            <div class="card">
              <div class="card-header class-header">
                <span><app-icon name="clipboard" :size="16"></app-icon> 类别表现</span>
                <select class="form-select" v-model="classCropFilter" :disabled="!classList.length">
                  <option value="">全部作物</option>
                  <option v-for="c in classCrops" :key="c" :value="c">{{ c }}</option>
                </select>
              </div>

              <div v-if="!classList.length" class="card-info-tip">
                <template v-if="classError">
                  <p style="color:var(--color-error);margin:0 0 4px;">⚠️ 加载失败：{{ classError }}</p>
                </template>
                <p style="margin:0;">暂未加载到类别表现数据，请确认已登录后台并刷新页面。</p>
              </div>

              <template v-else>
              <div class="class-overview-strip">
                <div>
                  <strong>{{ classList.length }}</strong>
                  <span>总类别</span>
                </div>
                <div>
                  <strong>{{ bestClassCount }}</strong>
                  <span>高表现</span>
                </div>
                <div>
                  <strong>{{ weakClassCount }}</strong>
                  <span>待关注</span>
                </div>
                <div>
                  <strong>{{ classCropSummary.length }}</strong>
                  <span>作物组</span>
                </div>
              </div>

              <div class="class-section-title">
                <span>作物表现</span>
                <small>点击作物可筛选明细</small>
              </div>
              <div class="crop-quality-list">
                <button
                  class="crop-quality-row"
                  v-for="item in classCropSummary"
                  :key="item.crop"
                  :class="{ selected: classCropFilter === item.crop }"
                  @click="selectCrop(item.crop)"
                >
                  <span class="crop-quality-name">{{ item.crop }}</span>
                  <span class="crop-quality-meta">{{ item.total }} 类</span>
                  <span class="crop-quality-bar">
                    <i :style="{ width: accWidth(item.avg) }"></i>
                  </span>
                  <span class="tag tag-sm" :class="accuracyClass(item.avg)">{{ formatAcc(item.avg) }}</span>
                  <span class="tag tag-sm" :class="item.weak ? 'tag-status-pending' : 'tag-status-approved'">
                    {{ item.weak ? item.weak + ' 个待关注' : '稳定' }}
                  </span>
                </button>
              </div>

              <div class="class-detail-panel">
                <div class="class-section-title">
                  <span>{{ classFocusTitle }}</span>
                  <small>{{ focusClasses.length }} 类</small>
                </div>
                <div class="class-grid" v-if="focusClasses.length">
                  <div v-for="c in focusClasses" :key="c.en" class="class-chip" :title="c.en">
                    <span class="class-name">
                      <small>{{ c.crop }}</small>
                      {{ c.cn }}
                    </span>
                    <span class="tag tag-sm" :class="accuracyClass(c.accuracy)">{{ formatAcc(c.accuracy) }}</span>
                  </div>
                </div>
                <div v-else class="card-info-tip">
                  当前筛选范围内没有需要重点关注的类别。
                </div>
              </div>
              </template>
            </div>
          </section>

          <aside class="dashboard-aside">
            <div class="card">
              <div class="card-header">
                <app-icon name="bar-chart" :size="16"></app-icon> 训练进度
              </div>
              <div class="train-status-head">
                <span class="status-badge" :class="isRunning ? 'status-pending' : training.status === 'done' ? 'status-approved' : training.status === 'error' ? 'status-rejected' : 'status-approved'">
                  {{ statusText }}
                </span>
                <strong>{{ progress.toFixed(1) }}%</strong>
              </div>
              <div class="conf-bar">
                <div class="conf-bar-fill conf-high" :style="{ width: progress + '%' }"></div>
              </div>
              <div class="summary-row"><span>当前轮次</span><span class="sr-val">{{ training.epoch || 0 }}/{{ training.totalEpochs || trainParams.epochs }}</span></div>
              <div class="summary-row"><span>验证损失</span><span class="sr-val">{{ training.loss ? Number(training.loss).toFixed(4) : '-' }}</span></div>
              <div class="summary-row"><span>验证准确率</span><span class="sr-val">{{ training.acc ? (Number(training.acc) * 100).toFixed(2) + '%' : '-' }}</span></div>
              <div class="summary-row" v-if="training.message"><span>状态说明</span><span class="sr-val">{{ training.message }}</span></div>
            </div>

            <div class="card">
              <div class="card-header">
                <app-icon name="terminal" :size="16"></app-icon> 训练日志
              </div>
              <pre class="train-log">{{ (training.logs || []).slice(-80).join('\\n') || '暂无训练日志' }}</pre>
            </div>
          </aside>
        </div>
      </div>

      <div v-if="showTrainConfirm" class="modal-overlay" @click.self="cancelTrainDialog">
        <div class="modal-dialog">
          <button class="modal-close" @click="cancelTrainDialog">
            <app-icon name="x" :size="16"></app-icon>
          </button>
          <div class="modal-header">
            <div class="modal-icon"><app-icon name="alert-triangle" :size="28"></app-icon></div>
            <h2 class="modal-title">确认开始训练</h2>
            <p class="modal-subtitle">
              将使用 {{ selectedDevice?.name || '自动选择' }} 执行 {{ trainParams.epochs }} 轮训练。
              数据来源为原始训练集{{ trainParams.includeContributed ? ' + 审核通过的贡献数据' : '' }}，完成后会刷新模型权重。
            </p>
          </div>
          <div class="modal-body" style="display:flex;gap:8px;justify-content:center;">
            <button class="btn btn-primary" @click="startTrain">
              <app-icon name="play" :size="16"></app-icon> 开始训练
            </button>
            <button class="btn btn-outline" @click="cancelTrainDialog">取消</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
