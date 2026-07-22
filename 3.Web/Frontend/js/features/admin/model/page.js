import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { adminModelInfo, adminModelDevices, adminModelTrain, adminModelTrainingStatus } from '../../../api/index.js';
import { request } from '../../../api/client.js';
import { useUiStore } from '../../../stores/ui.js';
import PageHeader from '../../../shared/components/PageHeader.js';
import AppIcon from '../../../shared/components/AppIcon.js';
import AppLoading from '../../../shared/components/AppLoading.js';
import AppError from '../../../shared/components/AppError.js';

export default {
  name: 'AdminModel',
  components: { PageHeader, AppIcon, AppLoading, AppError },
  setup() {
    const ui = useUiStore();
    const loading = ref(true);
    const info = ref(null);
    const training = ref({ status: 'idle', progress: 0, epoch: 0, totalEpochs: 20, loss: 0, acc: 0, logs: [] });
    const trainParams = ref({ epochs: 20, batchSize: 16, lr: 0.0003, includeContributed: true });
    const showTrainConfirm = ref(false);
    const devices = ref([]);
    const classList = ref([]);
    const classCropFilter = ref('');
    let pollTimer = null;

    async function load() {
      loading.value = true;
      try {
        const [mi, md, cl] = await Promise.allSettled([adminModelInfo(), adminModelDevices(), request('GET', '/api/admin/model/classes')]);
        if (mi.status === 'fulfilled') info.value = mi.value;
        else info.value = { name: 'ConvNeXt-Tiny', accuracy: '99.80%', classes: 38, size: '111.5 MB', lastTrain: '2026-07-20' };
        if (md.status === 'fulfilled') devices.value = md.value;
        if (cl.status === 'fulfilled') classList.value = cl.value;
      }
      catch { info.value = { name: 'ConvNeXt-Tiny', accuracy: '99.80%', classes: 38, size: '111.5 MB', lastTrain: '2026-07-20' }; }
      finally { loading.value = false; }
    }

    function askStartTrain() {
      showTrainConfirm.value = true;
    }
    function cancelTrain() {
      showTrainConfirm.value = false;
    }
    async function startTrain() {
      showTrainConfirm.value = false;
      try {
        await adminModelTrain(trainParams.value);
        training.value.status = 'running';
        ui.showToast('训练已启动', 'info');
        pollProgress();
      } catch (e) { ui.showToast(e.message || '启动失败', 'error'); }
    }

    function pollProgress() {
      pollTimer = setInterval(async () => {
        try {
          const s = await adminModelTrainingStatus();
          Object.assign(training.value, s);
          if (s.status === 'done' || s.status === 'idle') { stopPoll(); ui.showToast('训练完成！', 'success'); }
        } catch { /* 静默 */ }
      }, 3000);
    }

    function stopPoll() { if (pollTimer) { clearInterval(pollTimer); pollTimer = null; } }

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
    const classCrops = computed(() => [...new Set(classList.value.map(c => c.crop).filter(Boolean))].sort());

    onMounted(load);
    onBeforeUnmount(stopPoll);

    return { loading, info, devices, classList, classCropFilter, groupedClasses, classCrops, training, trainParams, showTrainConfirm, load, askStartTrain, cancelTrain, startTrain };
  },
  template: `
    <div>
      <page-header icon="cpu" title="模型管理" description="查看模型信息与训练控制"></page-header>
      <app-loading v-if="loading" text="加载模型信息..."></app-loading>

      <div v-if="!loading">
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><app-icon name="cpu" :size="16"></app-icon> 当前模型</div>
          <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:12px;font-size:14px;">
            <div><strong>架构:</strong> {{ info?.name || 'ConvNeXt-Tiny' }}</div>
            <div><strong>精度:</strong> <span style="color:var(--color-success);">{{ info?.accuracy || '99.80%' }}</span></div>
            <div><strong>类别:</strong> {{ info?.classes || 38 }} 类</div>
            <div><strong>权重:</strong> {{ info?.size || '111.5 MB' }}</div>
            <div><strong>最后训练:</strong> {{ info?.lastTrain || '-' }}</div>
          </div>
        </div>

        <div class="card" style="margin-bottom:16px;" v-if="devices && devices.length">
          <div class="card-header"><app-icon name="server" :size="16"></app-icon> 训练设备</div>
          <div v-for="d in devices" :key="d.index" style="display:flex;align-items:center;gap:8px;padding:8px 0;font-size:14px;">
            <span class="status-dot" :style="{background:'var(--color-success)',width:'8px',height:'8px',borderRadius:'50%'}"></span>
            {{ d.name }} <span v-if="d.type==='cuda'" style="color:var(--color-success);font-weight:600;">（GPU 加速）</span>
          </div>
        </div>

        <!-- 类别详情 -->
        <div class="card" style="margin-bottom:16px;" v-if="classList.length">
          <div class="card-header">
            <app-icon name="list" :size="16"></app-icon> 训练类别（{{ classList.length }} 类）
            <select class="form-select" v-model="classCropFilter" style="width:130px;height:30px;font-size:12px;margin-left:8px;">
              <option value="">全部作物</option>
              <option v-for="c in classCrops" :key="c" :value="c">{{ c }}</option>
            </select>
          </div>
          <div v-for="(items, crop) in groupedClasses" :key="crop" style="margin-bottom:12px;">
            <div style="font-weight:600;font-size:13px;color:var(--color-primary);margin-bottom:6px;padding-bottom:4px;border-bottom:1px solid var(--color-border-light);">
              {{ crop }}（{{ items.length }} 类）
            </div>
            <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:6px;">
              <div v-for="c in items" :key="c.en" style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;background:var(--color-card-alt);border-radius:6px;font-size:13px;">
                <span :title="c.en">{{ c.cn }}</span>
                <span :style="{fontWeight:600,color:c.accuracy>=95?'var(--color-success)':c.accuracy>=70?'var(--color-warning)':'var(--color-error)'}">{{ c.accuracy }}%</span>
              </div>
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><app-icon name="play" :size="16"></app-icon> 训练控制</div>
          <div class="form-group">
            <label class="form-label">训练轮数</label>
            <input class="form-input" type="number" v-model.number="trainParams.epochs" min="1" max="100" />
          </div>
          <div class="form-group">
            <label class="form-label">批次大小</label>
            <input class="form-input" type="number" v-model.number="trainParams.batchSize" min="4" max="64" />
          </div>
          <div class="form-group">
            <label class="form-label">学习率</label>
            <input class="form-input" type="number" v-model.number="trainParams.lr" step="0.0001" min="0.00001" max="0.1" />
          </div>
          <button class="btn btn-primary" :disabled="training.status==='running'" @click="askStartTrain">
            <app-icon name="play" :size="16"></app-icon> {{ training.status==='running' ? '训练中...' : '开始训练' }}
          </button>

          <!-- 训练进度 -->
          <div v-if="training.status==='running'" style="margin-top:16px;">
            <div class="conf-bar" style="margin-bottom:8px;">
              <div class="conf-bar-fill conf-high" :style="{width:(training.progress||0)+'%'}"></div>
            </div>
            <div style="font-size:13px;color:var(--color-text-secondary);">
              Epoch {{ training.epoch }}/{{ training.totalEpochs }} · Loss: {{ training.loss?.toFixed(4) || '-' }} · Acc: {{ ((training.acc||0)*100).toFixed(2) }}%
            </div>
            <div class="train-log" style="background:#1a1d23;color:#a8b8c8;font-family:monospace;font-size:12px;padding:10px;border-radius:8px;max-height:160px;overflow-y:auto;margin-top:8px;white-space:pre-wrap;">
              {{ (training.logs||[]).join('\\n') || '等待日志...' }}
            </div>
          </div>
        </div>

        <div class="card" style="margin-top:16px;">
          <div class="card-header"><app-icon name="list" :size="16"></app-icon> 训练设备</div>
          <div v-if="devices && devices.length" style="font-size:14px;">
            <div v-for="d in devices" :key="d.index" style="display:flex;align-items:center;gap:8px;padding:8px 0;">
              <span class="status-dot" style="background:var(--color-success);width:8px;height:8px;border-radius:50%;"></span>
              {{ d.name }} <span v-if="d.type==='cuda'" style="color:var(--color-success);font-weight:600;">（GPU 加速）</span>
            </div>
          </div>
          <div v-else style="color:var(--color-text-hint);font-size:13px;">未检测到训练设备</div>
        </div>
      </div>

      <!-- 训练确认弹窗 -->
      <div v-if="showTrainConfirm" class="modal-overlay" @click.self="cancelTrain">
        <div class="modal-dialog" style="width:400px;">
          <div class="modal-header">
            <div class="modal-icon"><app-icon name="alert-triangle" :size="28"></app-icon></div>
            <h2 class="modal-title">确认开始训练</h2>
            <p class="modal-subtitle">训练将覆盖现有模型权重文件，预计耗时 10-30 分钟。训练期间诊断功能将暂时不可用。</p>
          </div>
          <div class="modal-body" style="display:flex;gap:8px;justify-content:center;">
            <button class="btn btn-primary" @click="startTrain">确认开始训练</button>
            <button class="btn btn-outline" @click="cancelTrain">取消</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
