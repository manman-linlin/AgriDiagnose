/**
 * 病害百科页面
 * 作物筛选 + 关键词搜索 + 分类标签 + 卡片网格 + 详情抽屉
 *
 * 相比旧版：接入了真实后端接口（3.Web/Backend 新增的 /api/encyclopedia/*），
 * 不再有"请求失败静默 fallback 到硬编码假数据"的行为，请求失败时展示真实的错误态。
 */
import { ref, computed, watch } from 'vue';
import { navigate } from '../../router/index.js';
import { useDiagnosisStore } from '../../stores/diagnosis.js';
import { getEncyclopediaList, getEncyclopediaCrops } from '../../api/index.js';
import { useDebouncedRef } from '../../shared/composables/useDebouncedRef.js';
import AppLoading from '../../shared/components/AppLoading.js';
import AppEmpty from '../../shared/components/AppEmpty.js';
import AppError from '../../shared/components/AppError.js';
import AppIcon from '../../shared/components/AppIcon.js';
import PageHeader from '../../shared/components/PageHeader.js';

const BG_COLORS = ['#E8F5E9', '#F1F8E9', '#E3F2FD', '#FFF3E0', '#F3E5F5', '#E0F2F1'];

export default {
  name: 'PageEncyclopedia',
  components: { AppLoading, AppEmpty, AppError, AppIcon, PageHeader },
  setup() {
    const diagnosisStore = useDiagnosisStore();

    const searchQuery = ref('');
    const searchDebounced = useDebouncedRef(searchQuery, 300);
    const selectedCrop = ref('');
    const selectedCategory = ref('');
    const drawOpen = ref(false);
    const drawDisease = ref(null);
    const crops = ref([]);
    const categories = ['全部', '真菌性病害', '细菌性病害', '病毒性病害', '虫害', '\u5065\u5eb7\u72b6\u6001'];
    const diseases = ref([]);
    const currentPage = ref(1);
    const pageSize = 8;
    const loading = ref(false);
    const error = ref('');

    const filteredDiseases = computed(() => {
      let list = diseases.value;
      if (selectedCrop.value) {
        list = list.filter(d => d.crop_cn === selectedCrop.value);
      }
      if (searchDebounced.value.trim()) {
        const q = searchDebounced.value.trim().toLowerCase();
        list = list.filter(d =>
          d.name_cn.includes(q) ||
          d.name_en.toLowerCase().includes(q) ||
          (d.symptom_summary || '').includes(q)
        );
      }
      if (selectedCategory.value && selectedCategory.value !== '全部') {
        list = list.filter(d => d.category === selectedCategory.value);
      }
      return list;
    });

    const totalPages = computed(() => Math.max(1, Math.ceil(filteredDiseases.value.length / pageSize)));
    const paginatedDiseases = computed(() => {
      const start = (currentPage.value - 1) * pageSize;
      return filteredDiseases.value.slice(start, start + pageSize);
    });
    const pageNumbers = computed(() => Array.from({ length: totalPages.value }, (_, i) => i + 1));

    watch([selectedCrop, selectedCategory, searchDebounced], () => {
      currentPage.value = 1;
    });
    watch(totalPages, (pages) => {
      if (currentPage.value > pages) currentPage.value = pages;
    });

    function goToPage(page) {
      currentPage.value = Math.min(Math.max(page, 1), totalPages.value);
    }

    async function loadDiseases() {
      loading.value = true;
      error.value = '';
      try {
        diseases.value = (await getEncyclopediaList({})) || [];
      } catch (e) {
        error.value = e.message || '加载病害百科失败，请确认后端服务已启动';
        diseases.value = [];
      } finally {
        loading.value = false;
      }
    }

    async function loadCrops() {
      try {
        crops.value = (await getEncyclopediaCrops()) || [];
      } catch {
        crops.value = [];
      }
    }

    function selectCrop(crop) {
      selectedCrop.value = selectedCrop.value === crop ? '' : crop;
    }
    function selectCategory(cat) {
      selectedCategory.value = selectedCategory.value === cat ? '' : cat;
    }

    function openDetail(disease) {
      drawDisease.value = disease;
      drawOpen.value = true;
    }
    function closeDetail() {
      drawOpen.value = false;
      drawDisease.value = null;
    }

    function goDiagnose() { navigate('diagnose'); }
    function goChat(disease) {
      diagnosisStore.state.result = {
        top1: {
          label_cn: disease.name_cn,
          label_en: disease.class_en,
          crop: disease.crop_cn,
          disease: disease.name_cn,
          confidence: 100,
        },
      };
      diagnosisStore.state.status = 'done';
      navigate('chat');
    }

    function riskClass(d) {
      const r = (d?.risk_level || '').toLowerCase();
      if (r === '低' || r === 'low') return 'low';
      if (r === '中' || r === 'mid' || r === 'medium') return 'mid';
      if (r === '高' || r === 'high') return 'high';
      if (r === '严重') return 'high';
      return 'mid';
    }
    function riskLabel(d) {
      const map = { '低': '低风险', '中': '中风险', '高': '高风险', '严重': '严重' };
      return map[d?.risk_level] || (d?.risk_level || '未知');
    }
    function getBgColor(d) {
      const hash = d.name_cn.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
      return BG_COLORS[hash % BG_COLORS.length];
    }

    function imageSourceLabel(d) {
      const source = String(d?.image_source || d?.image_type || '').toLowerCase();
      if (source.includes('upload') || d?.image_uploaded) return '管理员上传图片';
      if (source.includes('dataset') || source.includes('sample') || d?.dataset_image) return '模型数据集样例';
      return '百科示例图片';
    }
    function textOrFallback(value, fallback) {
      const text = Array.isArray(value) ? value.filter(Boolean).join('?') : String(value || '').trim();
      if (!text || /^\?+$/.test(text) || text.includes('�')) return fallback;
      return text;
    }
    function validSources(sources) {
      return (sources || []).filter(source => {
        const text = `${source?.title || ''}${source?.organization || ''}`.trim();
        return text && !/^\?+$/.test(text) && !text.includes('�');
      });
    }
    function resetFilters() {
      searchQuery.value = '';
      selectedCrop.value = '';
      selectedCategory.value = '';
      currentPage.value = 1;
    }

    const highRiskCount = computed(() => diseases.value.filter(d => riskClass(d) === 'high').length);

    loadDiseases();
    loadCrops();

    // 从审核页跳转过来时自动打开对应病害详情
    (async () => {
      const focusClass = sessionStorage.getItem('encyclopedia_focus');
      if (!focusClass) return;
      sessionStorage.removeItem('encyclopedia_focus');
      await loadDiseases();
      const target = diseases.value.find(d => d.class_en === focusClass);
      if (target) openDetail(target);
    })();

    return {
      searchQuery, selectedCrop, selectedCategory, drawOpen, drawDisease,
      crops, categories, diseases, loading, error, filteredDiseases, paginatedDiseases,
      currentPage, totalPages, pageNumbers, highRiskCount,
      selectCrop, selectCategory, openDetail, closeDetail, goDiagnose, goChat, goToPage,
      riskClass, riskLabel, getBgColor, imageSourceLabel, textOrFallback, validSources, resetFilters, loadDiseases,
    };
  },
  template: `
    <div>
      <page-header
        icon="book-open"
        title="病害百科"
        description="收录常见农作物病害的症状、病因与防治方案，支持按作物筛选或关键词检索"
      ></page-header>

      <div class="stats-mini-row" v-if="!loading && !error">
        <div class="stats-mini-card stagger-item" :style="{ '--i': 0 }">
          <div class="stats-mini-num">{{ diseases.length }}</div>
          <div class="stats-mini-label">百科词条</div>
        </div>
        <div class="stats-mini-card stagger-item" :style="{ '--i': 1 }">
          <div class="stats-mini-num">{{ crops.length }}</div>
          <div class="stats-mini-label">覆盖作物</div>
        </div>
        <div class="stats-mini-card stagger-item" :style="{ '--i': 2 }">
          <div class="stats-mini-num" style="color:var(--color-error);">{{ highRiskCount }}</div>
          <div class="stats-mini-label">高风险词条</div>
        </div>
      </div>

      <!-- 搜索 + 筛选 -->
      <div class="encyclopedia-toolbar">
        <div class="search-box">
          <span class="search-icon"><app-icon name="search" :size="15"></app-icon></span>
          <input v-model="searchQuery" placeholder="搜索病害名称、症状关键词..." />
        </div>
        <div class="category-tags">
          <span
            v-for="cat in categories"
            :key="cat"
            class="category-tag"
            :class="{ active: (selectedCategory || '全部') === cat }"
            @click="selectCategory(cat)"
          >{{ cat === '全部' ? '全部 (' + diseases.length + ')' : cat }}</span>
        </div>
      </div>

      <app-error
        v-if="error && !loading"
        :message="error"
        :retryable="true"
        @retry="loadDiseases"
      ></app-error>

      <!-- 内容区：作物侧栏 + 卡片网格 -->
      <div class="encyclopedia-layout" v-if="!error">
        <!-- 作物筛选侧栏 -->
        <div class="encyclopedia-sidebar">
          <div
            class="crop-filter-item"
            :class="{ active: !selectedCrop }"
            @click="selectedCrop = ''"
          >
            全部<span class="crop-count">{{ diseases.length }}</span>
          </div>
          <div
            v-for="crop in crops"
            :key="crop.name"
            class="crop-filter-item"
            :class="{ active: selectedCrop === crop.name }"
            @click="selectCrop(crop.name)"
          >
            {{ crop.name }}<span class="crop-count">{{ crop.count }}</span>
          </div>
        </div>

        <!-- 卡片网格 -->
        <div style="flex:1;min-width:0;">
          <app-loading v-if="loading" text="加载百科数据..." :inline="true"></app-loading>

          <div v-if="!loading" class="disease-grid">
            <div
              v-for="(d, idx) in paginatedDiseases"
              :key="d.id"
              class="disease-card stagger-item"
              :style="{ '--i': idx }"
              @click="openDetail(d)"
            >
              <div class="disease-img" :style="{ background: getBgColor(d) }">
                <img v-if="d.image_url" :src="d.image_url" :alt="d.name_cn + '示例图'" loading="lazy" />
                <app-icon v-else name="image" :size="32"></app-icon>
              </div>
              <div class="disease-body">
                <div class="disease-tags">
                  <span class="tag tag-crop">{{ d.crop_cn }}</span>
                  <span class="tag" :class="'tag-risk-'+riskClass(d)" style="display:inline-flex;align-items:center;gap:4px;">
                    <app-icon name="alert-triangle" :size="10"></app-icon>{{ riskLabel(d) }}
                  </span>
                </div>
                <div class="disease-title">{{ d.name_cn }}</div>
                <div class="disease-en">{{ d.name_en }}</div>
                <div class="disease-summary">{{ d.symptom_summary || '暂无描述' }}</div>
                <div class="disease-link">查看详情 →</div>
              </div>
            </div>
          </div>

          <nav v-if="!loading && totalPages > 1" class="encyclopedia-pagination" aria-label="病害百科分页">
            <button class="page-button page-nav" :disabled="currentPage === 1" @click="goToPage(currentPage - 1)">上一页</button>
            <button
              v-for="page in pageNumbers"
              :key="page"
              class="page-button"
              :class="{ active: currentPage === page }"
              :aria-current="currentPage === page ? 'page' : null"
              @click="goToPage(page)"
            >{{ page }}</button>
            <button class="page-button page-nav" :disabled="currentPage === totalPages" @click="goToPage(currentPage + 1)">下一页</button>
            <span class="page-summary">第 {{ currentPage }} / {{ totalPages }} 页，共 {{ filteredDiseases.length }} 条</span>
          </nav>

          <app-empty
            v-if="!loading && filteredDiseases.length === 0"
            icon="search"
            title="未找到相关词条"
            description="试试其他关键词或浏览全部"
            action-label="查看全部词条"
            @action="resetFilters"
          ></app-empty>
        </div>
      </div>

      <!-- 详情抽屉 -->
      <div class="drawer-overlay" :class="{ open: drawOpen }" @click="closeDetail"></div>
      <div class="drawer" :class="{ open: drawOpen }">
        <button class="drawer-close" @click="closeDetail"><app-icon name="x" :size="16"></app-icon></button>
        <div v-if="drawDisease">
          <div style="font-size:22px;font-weight:700;margin-bottom:4px;display:flex;align-items:center;gap:8px;">
            <app-icon name="bug" :size="20"></app-icon> {{ drawDisease.name_cn }}
          </div>
          <div style="font-size:13px;color:#999;margin-bottom:12px;">
            {{ drawDisease.name_en }}
          </div>

          <div v-if="drawDisease.image_url" class="encyclopedia-detail-image">
            <img :src="drawDisease.image_url" :alt="drawDisease.name_cn + '示例图'" />
            <span>{{ imageSourceLabel(drawDisease) }}</span>
          </div>

          <div style="display:flex;gap:6px;margin-bottom:20px;">
            <span class="tag tag-md tag-crop">{{ drawDisease.crop_cn }}</span>
            <span class="tag tag-md" :class="'tag-risk-'+riskClass(drawDisease)" style="display:inline-flex;align-items:center;gap:4px;">
              <app-icon name="alert-triangle" :size="12"></app-icon>{{ riskLabel(drawDisease) }}
            </span>
            <span class="tag tag-md tag-category">{{ drawDisease.category || '未知' }}</span>
          </div>

          <!-- 典型症状 -->
          <div class="card" style="padding:18px;">
            <div style="font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:6px;"><app-icon name="stethoscope" :size="15"></app-icon> 典型症状</div>
            <div style="font-size:14px;color:#666;line-height:1.8;">
              <div v-for="(s, i) in (drawDisease.symptoms || [])" :key="i">{{ i + 1 }}. {{ s }}</div>
            </div>
          </div>

          <div class="card encyclopedia-detail-section">
            <div class="detail-section-title"><app-icon name="thermometer" :size="15"></app-icon> 发病规律</div>
            <div class="detail-section-text">{{ textOrFallback(drawDisease.epidemiology, '暂无专门记录。高发条件因作物和地区而异，建议结合当地气象与历史情况研判。') }}</div>
          </div>
          <div class="card encyclopedia-detail-section">
            <div class="detail-section-title"><app-icon name="bug" :size="15"></app-icon> 病原 / 诱因</div>
            <div class="detail-section-text">{{ textOrFallback(drawDisease.pathogen, '暂无病原或诱因资料。') }}</div>
          </div>
          <div class="card encyclopedia-detail-section">
            <div class="detail-section-title"><app-icon name="search" :size="15"></app-icon> 鉴别要点</div>
            <div class="detail-section-text">{{ textOrFallback(drawDisease.differentiation, '暂无专门鉴别记录，建议结合典型症状并咨询农技人员。') }}</div>
          </div>
          <!-- 防治方案 -->
          <div class="card" style="padding:18px;">
            <div style="font-weight:600;margin-bottom:8px;display:flex;align-items:center;gap:6px;"><app-icon name="shield" :size="15"></app-icon> 防治方案</div>
            <div style="font-size:14px;color:#666;line-height:1.8;">
              <div style="font-weight:600;margin-top:8px;">【预防措施】</div>
              <div v-for="(p, i) in (drawDisease.prevention || [])" :key="'p'+i" style="display:flex;gap:6px;"><app-icon name="check" :size="12" style="margin-top:4px;flex-shrink:0;"></app-icon>{{ p }}</div>
              <div style="font-weight:600;margin-top:8px;">【化学防治】</div>
              <div v-for="(t, i) in (drawDisease.treatment || [])" :key="'t'+i" style="display:flex;gap:6px;"><app-icon name="check" :size="12" style="margin-top:4px;flex-shrink:0;"></app-icon>{{ t }}</div>
            </div>
            <div style="margin-top:10px;font-size:12px;color:var(--color-accent);display:flex;align-items:center;gap:6px;">
              <app-icon name="alert-triangle" :size="13"></app-icon> 以上建议仅供参考，请在农技人员指导下用药
            </div>
          </div>

          <div v-if="validSources(drawDisease.sources).length" class="card encyclopedia-detail-section">
            <div class="detail-section-title"><app-icon name="book-open" :size="15"></app-icon> 资料来源</div>
            <ul class="encyclopedia-source-list"><li v-for="(source, i) in validSources(drawDisease.sources)" :key="i"><a v-if="source.url" :href="source.url" target="_blank" rel="noopener noreferrer">{{ source.title || source.url }}</a><span v-else>{{ source.title }}</span><small v-if="source.organization">{{ source.organization }}</small></li></ul>
          </div>
          <!-- 快捷操作 -->
          <div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;">
            <button class="btn btn-secondary" style="flex:1;min-width:140px;" @click="goDiagnose()">
              <app-icon name="upload" :size="15"></app-icon> 上传图片诊断
            </button>
            <button class="btn btn-primary" style="flex:1;min-width:140px;" @click="closeDetail(); goChat(drawDisease)">
              <app-icon name="bot" :size="15"></app-icon> 咨询防治建议
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
};
