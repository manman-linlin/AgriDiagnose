/**
 * 智能诊断页面 — 仪表盘两栏布局：左侧上传/诊断/结果主流程，右侧栏放拍摄建议、
 * 最近诊断记录快照与站内快捷入口，充分利用宽屏空间，减少纯纵向堆叠的单薄感。
 */
import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { useDiagnosisStore } from '../../stores/diagnosis.js';
import { useHistoryStore } from '../../stores/history.js';
import { navigate } from '../../router/index.js';
import { predict, getHistory } from '../../api/index.js';
import ImageUploader from './components/ImageUploader.js';
import ResultCard from './components/ResultCard.js';
import AppLoading from '../../shared/components/AppLoading.js';
import AppError from '../../shared/components/AppError.js';
import AppIcon from '../../shared/components/AppIcon.js';
import PageHeader from '../../shared/components/PageHeader.js';

export default {
  name: 'PageDiagnose',
  components: { ImageUploader, ResultCard, AppLoading, AppError, AppIcon, PageHeader },
  setup() {
    const store = useDiagnosisStore();
    const historyStore = useHistoryStore();

    const file = ref(null);
    const previewUrl = ref(null);
    const loading = ref(false);
    const tipsExpanded = ref(true);

    const result = computed(() => store.state.result);
    const error = computed(() => store.state.error);
    const showResult = computed(() => store.state.status === 'done' && !loading.value);
    const recentHistory = computed(() => historyStore.state.records.slice(0, 3));

    function revokePreview() {
      if (previewUrl.value) URL.revokeObjectURL(previewUrl.value);
    }

    function onFileChange(f) {
      file.value = f;
      revokePreview();
      previewUrl.value = URL.createObjectURL(f);
      store.reset();
      store.state.status = 'uploading';
      store.state.imageUrl = previewUrl.value;
      store.state.imageFile = f;
    }

    function onClearFile() {
      file.value = null;
      revokePreview();
      previewUrl.value = null;
      store.reset();
    }

    async function submit() {
      if (!file.value || loading.value) return;
      loading.value = true;
      store.state.status = 'loading';
      store.state.error = null;

      try {
        const data = await predict(file.value);
        store.setResult(data);
        loadRecentHistory();
      } catch (e) {
        store.setError(e.message || '网络请求失败，请确认后端服务已启动');
      } finally {
        loading.value = false;
      }
    }

    function goChat()         { navigate('chat'); }
    function goContribute()   { navigate('contribute'); }
    function goEncyclopedia() { navigate('encyclopedia'); }
    function goHistory()      { navigate('history'); }

    function resetDiagnosis() {
      file.value = null;
      revokePreview();
      previewUrl.value = null;
      store.reset();
    }

    function toggleTips() { tipsExpanded.value = !tipsExpanded.value; }

    async function loadRecentHistory() {
      try {
        historyStore.state.records = await getHistory();
      } catch { /* 侧栏为辅助信息，静默失败即可 */ }
    }

    onMounted(loadRecentHistory);
    onBeforeUnmount(revokePreview);

    return {
      file, previewUrl, loading, tipsExpanded, result, error, showResult, recentHistory,
      onFileChange, onClearFile, submit, goChat, goContribute, goEncyclopedia, goHistory,
      resetDiagnosis, toggleTips,
    };
  },
  template: `
    <div>
      <page-header
        icon="search"
        title="智能诊断"
        description="上传作物叶片照片，AI 模型将自动识别病害类型并给出置信度评估"
      ></page-header>

      <div class="dashboard-grid">
        <!-- ═══ 主流程：上传 / 加载 / 错误 / 结果 ═══ -->
        <div class="dashboard-main">
          <div class="card" style="animation: fadeScaleIn 0.35s cubic-bezier(0.4, 0, 0.2, 1);">
            <div class="card-header"><app-icon name="camera"></app-icon> 上传叶片图片</div>
            <image-uploader
              :preview-url="previewUrl"
              :disabled="loading"
              @file-change="onFileChange"
              @clear="onClearFile"
            ></image-uploader>

            <button
              class="btn btn-primary btn-block"
              :disabled="!file || loading"
              @click="submit"
              style="margin-top:14px;"
            >
              <app-icon v-if="!loading" name="search" :size="16"></app-icon>
              {{ loading ? '识别中...' : '开始诊断' }}
            </button>
            <button
              v-if="file && !loading"
              class="btn btn-outline btn-block"
              style="margin-top:10px;"
              @click="resetDiagnosis"
            >重新选择</button>
          </div>

          <app-loading
            v-if="loading"
            text="正在分析叶片特征，识别病害类型..."
          ></app-loading>

          <app-error
            v-if="error && !loading"
            :message="error"
            :retryable="true"
            @retry="submit"
          ></app-error>

          <result-card
            v-if="showResult"
            :result="result"
            @chat="goChat"
            @contribute="goContribute"
            @encyclopedia="goEncyclopedia"
            @reset="resetDiagnosis"
          ></result-card>
        </div>

        <!-- ═══ 侧栏：拍摄建议 / 最近诊断 / 快捷入口 ═══ -->
        <aside class="dashboard-aside">
          <div class="card card-info-tip">
            <div
              class="tips-toggle"
              style="font-size:14px;font-weight:600;color:var(--color-text-secondary);display:flex;justify-content:space-between;align-items:center;"
              @click="toggleTips"
            >
              <span style="display:flex;align-items:center;gap:6px;"><app-icon name="lightbulb" :size="15"></app-icon> 拍摄建议</span>
              <app-icon name="chevron-down" :size="14" style="transition:transform 0.3s ease;" :style="{ transform: tipsExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }"></app-icon>
            </div>
            <div class="tips-body" :class="{ collapsed: !tipsExpanded }">
              <div style="font-size:13px;color:var(--color-text-hint);line-height:1.8;">
                <app-icon name="check" :size="12"></app-icon> 叶片置于平整背景（如白纸）上拍摄<br>
                <app-icon name="check" :size="12"></app-icon> 确保叶片主体清晰、光线均匀<br>
                <app-icon name="check" :size="12"></app-icon> 一张图片只包含一种病害叶片<br>
                <app-icon name="check" :size="12"></app-icon> 避免强光直射或严重阴影
              </div>
            </div>
          </div>

          <div class="card" v-if="recentHistory.length">
            <div class="card-header"><app-icon name="clock"></app-icon> 最近诊断</div>
            <div class="mini-history-list">
              <div v-for="item in recentHistory" :key="item.id" class="mini-history-item" @click="goHistory">
                <img :src="item.image_url" :alt="item.top1.label_cn" loading="lazy" @error="$event.target.style.visibility='hidden'" />
                <div class="mh-info">
                  <div class="mh-label">{{ item.top1.label_cn }}</div>
                  <div class="mh-meta">{{ item.top1.crop }}</div>
                </div>
                <div class="mh-score">{{ item.top1.confidence }}%</div>
              </div>
            </div>
            <button class="btn btn-text" style="width:100%;margin-top:6px;justify-content:center;" @click="goHistory">查看全部记录</button>
          </div>

          <div class="card">
            <div class="card-header"><app-icon name="sparkle"></app-icon> 快捷入口</div>
            <div class="quick-link-item" @click="goChat">
              <app-icon name="bot" :size="16" class="qli-icon"></app-icon> AI 智能问答
            </div>
            <div class="quick-link-item" @click="goEncyclopedia">
              <app-icon name="book-open" :size="16" class="qli-icon"></app-icon> 浏览病害百科
            </div>
            <div class="quick-link-item" @click="goContribute">
              <app-icon name="upload" :size="16" class="qli-icon"></app-icon> 贡献标注数据
            </div>
          </div>
        </aside>
      </div>
    </div>
  `,
};
