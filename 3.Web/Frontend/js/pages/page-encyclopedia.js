/**
 * 病害百科页面
 * 作物筛选 + 关键词搜索 + 分类标签 + 卡片网格 + 详情抽屉
 */
window.makePageEncyclopedia = function () {
  const router = window.AppRouter;

  return {
    data() {
      return {
        searchQuery: '',
        searchDebounced: '',
        selectedCrop: '',
        selectedCategory: '',
        drawOpen: false,
        drawDisease: null,
        crops: [],
        categories: ['全部', '真菌性病害', '细菌性病害', '病毒性病害', '虫害'],
        diseases: [],
        loading: false,
        searchTimer: null,
        resultCountPop: false,
      };
    },
    computed: {
      filteredDiseases() {
        let list = this.diseases;
        if (this.selectedCrop) {
          list = list.filter(d => d.crop_cn === this.selectedCrop);
        }
        if (this.searchDebounced.trim()) {
          const q = this.searchDebounced.trim().toLowerCase();
          list = list.filter(d =>
            d.name_cn.includes(q) ||
            d.name_en.toLowerCase().includes(q) ||
            (d.symptom_summary || '').includes(q)
          );
        }
        if (this.selectedCategory && this.selectedCategory !== '全部') {
          list = list.filter(d => d.category === this.selectedCategory);
        }
        return list;
      },
    },
    watch: {
      searchQuery(val) {
        if (this.searchTimer) clearTimeout(this.searchTimer);
        this.searchTimer = setTimeout(() => {
          this.searchDebounced = val;
          this.resultCountPop = true;
          setTimeout(() => { this.resultCountPop = false; }, 400);
        }, 300);
      },
    },
    created() {
      this.loadDiseases();
      this.loadCrops();
    },
    beforeUnmount() {
      if (this.searchTimer) clearTimeout(this.searchTimer);
    },
    methods: {
      async loadDiseases() {
        this.loading = true;
        try {
          const data = await window.Api.getEncyclopediaList({});
          this.diseases = data || [];
        } catch {
          // 百科后端暂未就绪，使用内置静态数据
          this.diseases = this.getStaticData();
        } finally {
          this.loading = false;
        }
      },
      getStaticData() {
        // 从 class_labels 构建基础展示数据
        const crops = ['苹果', '蓝莓', '樱桃', '玉米', '葡萄', '柑橘', '桃', '甜椒', '马铃薯', '覆盆子', '大豆', '南瓜', '草莓', '番茄'];
        const diseases = [
          { class_en: 'Apple___Apple_scab', name_cn: '苹果黑星病', name_en: 'Apple Scab', crop_cn: '苹果', category: '真菌性病害', risk_level: '中', symptom_summary: '叶片出现橄榄绿色至黑色病斑，严重时叶片脱落。' },
          { class_en: 'Apple___Black_rot', name_cn: '苹果黑腐病', name_en: 'Apple Black Rot', crop_cn: '苹果', category: '真菌性病害', risk_level: '高', symptom_summary: '果实出现褐色腐烂斑并逐渐变黑，叶片有紫色斑点。' },
          { class_en: 'Apple___Cedar_apple_rust', name_cn: '苹果锈病', name_en: 'Cedar Apple Rust', crop_cn: '苹果', category: '真菌性病害', risk_level: '中', symptom_summary: '叶片正面出现橙黄色斑点，背面形成毛状物。' },
          { class_en: 'Cherry___Powdery_mildew', name_cn: '樱桃白粉病', name_en: 'Cherry Powdery Mildew', crop_cn: '樱桃', category: '真菌性病害', risk_level: '中', symptom_summary: '叶片表面覆盖白色粉状物，影响光合作用。' },
          { class_en: 'Corn___Cercospora_leaf_spot', name_cn: '玉米灰斑病', name_en: 'Corn Gray Leaf Spot', crop_cn: '玉米', category: '真菌性病害', risk_level: '高', symptom_summary: '叶片出现灰色矩形病斑，严重时整叶枯死。' },
          { class_en: 'Corn___Common_rust', name_cn: '玉米锈病', name_en: 'Corn Common Rust', crop_cn: '玉米', category: '真菌性病害', risk_level: '中', symptom_summary: '叶片出现铁锈色粉状小突起，影响生长。' },
          { class_en: 'Corn___Northern_Leaf_Blight', name_cn: '玉米北方叶枯病', name_en: 'Corn Northern Leaf Blight', crop_cn: '玉米', category: '真菌性病害', risk_level: '高', symptom_summary: '叶片出现灰绿色至褐色大型梭形病斑。' },
          { class_en: 'Grape___Black_rot', name_cn: '葡萄黑腐病', name_en: 'Grape Black Rot', crop_cn: '葡萄', category: '真菌性病害', risk_level: '高', symptom_summary: '果粒变褐变黑并干缩，叶片有褐色病斑。' },
          { class_en: 'Grape___Esca', name_cn: '葡萄黑麻疹病', name_en: 'Grape Esca', crop_cn: '葡萄', category: '真菌性病害', risk_level: '高', symptom_summary: '叶片出现虎斑状褪绿，维管束变褐坏死。' },
          { class_en: 'Grape___Leaf_blight', name_cn: '葡萄叶枯病', name_en: 'Grape Leaf Blight', crop_cn: '葡萄', category: '真菌性病害', risk_level: '中', symptom_summary: '叶片边缘焦枯，逐渐向内部扩展。' },
          { class_en: 'Orange___Haunglongbing', name_cn: '柑橘黄龙病', name_en: 'Citrus Huanglongbing', crop_cn: '柑橘', category: '细菌性病害', risk_level: '严重', symptom_summary: '叶片斑驳黄化、变小变硬，果实畸形，是柑橘毁灭性病害。' },
          { class_en: 'Peach___Bacterial_spot', name_cn: '桃细菌性斑点病', name_en: 'Peach Bacterial Spot', crop_cn: '桃', category: '细菌性病害', risk_level: '中', symptom_summary: '叶片出现水渍状小斑点，严重时穿孔脱落。' },
          { class_en: 'Pepper_bell___Bacterial_spot', name_cn: '甜椒细菌性斑点病', name_en: 'Pepper Bacterial Spot', crop_cn: '甜椒', category: '细菌性病害', risk_level: '中', symptom_summary: '叶片和果实出现褐色水渍状斑点。' },
          { class_en: 'Potato___Early_blight', name_cn: '马铃薯早疫病', name_en: 'Potato Early Blight', crop_cn: '马铃薯', category: '真菌性病害', risk_level: '中', symptom_summary: '叶片出现褐色同心轮纹病斑。' },
          { class_en: 'Potato___Late_blight', name_cn: '马铃薯晚疫病', name_en: 'Potato Late Blight', crop_cn: '马铃薯', category: '真菌性病害', risk_level: '严重', symptom_summary: '叶片出现水渍状斑块，湿度大时有白色霉层，是马铃薯毁灭性病害。' },
          { class_en: 'Squash___Powdery_mildew', name_cn: '南瓜白粉病', name_en: 'Squash Powdery Mildew', crop_cn: '南瓜', category: '真菌性病害', risk_level: '中', symptom_summary: '叶片表面覆盖白色粉状物质，严重时叶片枯黄。' },
          { class_en: 'Strawberry___Leaf_scorch', name_cn: '草莓叶枯病', name_en: 'Strawberry Leaf Scorch', crop_cn: '草莓', category: '真菌性病害', risk_level: '中', symptom_summary: '叶片边缘出现紫褐色坏死斑，逐渐向内扩展。' },
          { class_en: 'Tomato___Early_blight', name_cn: '番茄早疫病', name_en: 'Tomato Early Blight', crop_cn: '番茄', category: '真菌性病害', risk_level: '中', symptom_summary: '叶片出现褐色圆形病斑，有同心轮纹，边缘清晰。' },
          { class_en: 'Tomato___Late_blight', name_cn: '番茄晚疫病', name_en: 'Tomato Late Blight', crop_cn: '番茄', category: '真菌性病害', risk_level: '严重', symptom_summary: '叶片出现水渍状斑块并迅速扩大，湿度大时有白色霉层。' },
          { class_en: 'Tomato___Leaf_Mold', name_cn: '番茄叶霉病', name_en: 'Tomato Leaf Mold', crop_cn: '番茄', category: '真菌性病害', risk_level: '中', symptom_summary: '叶片背面出现黄绿色霉斑，正面出现褪绿斑块。' },
          { class_en: 'Tomato___Septoria_leaf_spot', name_cn: '番茄斑枯病', name_en: 'Tomato Septoria Leaf Spot', crop_cn: '番茄', category: '真菌性病害', risk_level: '中', symptom_summary: '叶片出现小圆形灰色病斑，中央灰白色边缘深褐色。' },
          { class_en: 'Tomato___Spider_mites', name_cn: '番茄红蜘蛛', name_en: 'Tomato Spider Mites', crop_cn: '番茄', category: '虫害', risk_level: '高', symptom_summary: '叶片出现黄白色斑点，叶背有红色螨虫和蛛丝。' },
          { class_en: 'Tomato___Target_Spot', name_cn: '番茄靶斑病', name_en: 'Tomato Target Spot', crop_cn: '番茄', category: '真菌性病害', risk_level: '中', symptom_summary: '叶片出现同心环状褐色病斑，似靶心状。' },
          { class_en: 'Tomato___Tomato_Yellow_Leaf_Curl_Virus', name_cn: '番茄黄化曲叶病毒病', name_en: 'Tomato Yellow Leaf Curl', crop_cn: '番茄', category: '病毒性病害', risk_level: '严重', symptom_summary: '植株矮化，叶片黄化卷曲变小，由烟粉虱传播。' },
          { class_en: 'Tomato___Tomato_mosaic_virus', name_cn: '番茄花叶病毒病', name_en: 'Tomato Mosaic Virus', crop_cn: '番茄', category: '病毒性病害', risk_level: '高', symptom_summary: '叶片出现黄绿相间花叶斑驳，植株生长迟缓。' },
          { class_en: 'Tomato___Bacterial_spot', name_cn: '番茄细菌性斑点病', name_en: 'Tomato Bacterial Spot', crop_cn: '番茄', category: '细菌性病害', risk_level: '中', symptom_summary: '叶片和果实出现褐色水渍状小斑点。' },
        ];
        return diseases.map(d => ({
          ...d,
          id: d.class_en.toLowerCase().replace(/[^a-z0-9]+/g, '_'),
          images: [],
          symptoms: [d.symptom_summary],
          prevention: ['选择抗病品种', '合理轮作', '加强田间管理'],
          treatment: ['发病初期使用针对性药剂', '注意安全间隔期'],
        }));
      },
      async loadCrops() {
        try {
          this.crops = await window.Api.getEncyclopediaCrops();
        } catch {
          this.crops = [
            { name: '苹果', count: 3 }, { name: '蓝莓', count: 0 },
            { name: '樱桃', count: 1 }, { name: '玉米', count: 3 },
            { name: '葡萄', count: 3 }, { name: '柑橘', count: 1 },
            { name: '桃', count: 1 }, { name: '甜椒', count: 1 },
            { name: '马铃薯', count: 2 }, { name: '覆盆子', count: 0 },
            { name: '大豆', count: 0 }, { name: '南瓜', count: 1 },
            { name: '草莓', count: 1 }, { name: '番茄', count: 8 },
          ];
        }
      },

      selectCrop(crop) {
        this.selectedCrop = this.selectedCrop === crop ? '' : crop;
      },
      selectCategory(cat) {
        this.selectedCategory = this.selectedCategory === cat ? '' : cat;
      },

      openDetail(disease) {
        this.drawDisease = disease;
        this.drawOpen = true;
      },
      closeDetail() {
        this.drawOpen = false;
        this.drawDisease = null;
      },

      goDiagnose() { router.navigate('diagnose'); },
      goChat(disease) {
        window.AppStore.diagnosis.result = {
          top1: {
            label_cn: disease.name_cn,
            label_en: disease.class_en,
            crop: disease.crop_cn,
            disease: disease.name_cn,
            confidence: 100,
          },
        };
        window.AppStore.diagnosis.status = 'done';
        router.navigate('chat');
      },

      riskClass(d) {
        const r = (d.risk_level || '').toLowerCase();
        if (r === '低' || r === 'low') return 'low';
        if (r === '中' || r === 'mid' || r === 'medium') return 'mid';
        if (r === '高' || r === 'high') return 'high';
        if (r === '严重') return 'high';
        return 'mid';
      },
      riskLabel(d) {
        const map = { '低': '🟢 低风险', '中': '🟡 中风险', '高': '🟠 高风险', '严重': '🔴 严重' };
        return map[d.risk_level] || ('⚠️ ' + (d.risk_level || '未知'));
      },
      getBgColor(d) {
        const colors = ['#E8F5E9','#F1F8E9','#E3F2FD','#FFF3E0','#F3E5F5','#E0F2F1'];
        const hash = d.name_cn.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
        return colors[hash % colors.length];
      },
    },
    template: `
      <div>
        <!-- 搜索 + 筛选 -->
        <div class="encyclopedia-toolbar">
          <div class="search-box">
            <span class="search-icon">🔍</span>
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

        <!-- 内容区：作物侧栏 + 卡片网格 -->
        <div class="encyclopedia-layout">
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
                v-for="(d, idx) in filteredDiseases"
                :key="d.id"
                class="disease-card stagger-item"
                :style="{ '--i': idx }"
                @click="openDetail(d)"
              >
                <div class="disease-img" :style="{ background: getBgColor(d) }"></div>
                <div class="disease-body">
                  <div class="disease-tags">
                    <span class="tag tag-crop">{{ d.crop_cn }}</span>
                    <span class="tag" :class="'tag-risk-'+riskClass(d)">{{ riskLabel(d) }}</span>
                  </div>
                  <div class="disease-title">{{ d.name_cn }}</div>
                  <div class="disease-en">{{ d.name_en }}</div>
                  <div class="disease-summary">{{ d.symptom_summary || '暂无描述' }}</div>
                  <div class="disease-link">查看详情 →</div>
                </div>
              </div>
            </div>

            <app-empty
              v-if="!loading && filteredDiseases.length === 0"
              icon="🔍"
              title="未找到相关病害"
              description="试试其他关键词或浏览全部"
              action-label="查看全部病害"
              @action="searchQuery='';selectedCrop='';selectedCategory='';"
            ></app-empty>
          </div>
        </div>

        <!-- 详情抽屉 -->
        <div class="drawer-overlay" :class="{ open: drawOpen }" @click="closeDetail"></div>
        <div class="drawer" :class="{ open: drawOpen }">
          <button class="drawer-close" @click="closeDetail">✕</button>
          <div v-if="drawDisease">
            <div style="font-size:22px;font-weight:700;margin-bottom:4px;">
              🦠 {{ drawDisease.name_cn }}
            </div>
            <div style="font-size:13px;color:#999;margin-bottom:12px;">
              {{ drawDisease.name_en }}
            </div>

            <div style="display:flex;gap:6px;margin-bottom:20px;">
              <span class="tag tag-md tag-crop">{{ drawDisease.crop_cn }}</span>
              <span class="tag tag-md" :class="'tag-risk-'+riskClass(drawDisease)">{{ riskLabel(drawDisease) }}</span>
              <span class="tag tag-md tag-category">{{ drawDisease.category || '未知' }}</span>
            </div>

            <!-- 典型症状 -->
            <div class="card" style="padding:18px;">
              <div style="font-weight:600;margin-bottom:8px;">🩺 典型症状</div>
              <div style="font-size:14px;color:#666;line-height:1.8;">
                <div v-for="(s, i) in (drawDisease.symptoms || [])" :key="i">{{ i + 1 }}. {{ s }}</div>
              </div>
            </div>

            <!-- 发病规律 -->
            <div class="card" style="padding:18px;">
              <div style="font-weight:600;margin-bottom:8px;">🌡️ 发病规律</div>
              <div style="font-size:14px;color:#666;line-height:1.8;">
                高发季节视作物和地区而定，温暖潮湿环境易流行。建议结合当地气象条件和历史发病情况进行综合研判。
              </div>
            </div>

            <!-- 防治方案 -->
            <div class="card" style="padding:18px;">
              <div style="font-weight:600;margin-bottom:8px;">🛡️ 防治方案</div>
              <div style="font-size:14px;color:#666;line-height:1.8;">
                <div style="font-weight:600;margin-top:8px;">【预防措施】</div>
                <div v-for="(p, i) in (drawDisease.prevention || [])" :key="'p'+i">✓ {{ p }}</div>
                <div style="font-weight:600;margin-top:8px;">【化学防治】</div>
                <div v-for="(t, i) in (drawDisease.treatment || [])" :key="'t'+i">✓ {{ t }}</div>
              </div>
              <div style="margin-top:10px;font-size:12px;color:var(--color-accent);">
                ⚠️ 以上建议仅供参考，请在农技人员指导下用药
              </div>
            </div>

            <!-- 快捷操作 -->
            <div style="display:flex;gap:12px;margin-top:16px;flex-wrap:wrap;">
              <button class="btn btn-secondary" style="flex:1;min-width:140px;" @click="goDiagnose()">
                📤 上传图片诊断
              </button>
              <button class="btn btn-primary" style="flex:1;min-width:140px;" @click="closeDetail(); goChat(drawDisease)">
                🤖 咨询防治建议
              </button>
            </div>
          </div>
        </div>
      </div>
    `,
    // 注意：riskClass / riskLabel / getBgColor 已在上面 methods 中定义，此处不重复
  };
};
