import { ref, computed, onMounted } from 'vue';
import { getEncyclopediaList, adminEncyclopediaCreate, adminEncyclopediaUpdate, adminEncyclopediaDelete } from '../../../api/index.js';
import { request } from '../../../api/client.js';
import { useUiStore } from '../../../stores/ui.js';
import PageHeader from '../../../shared/components/PageHeader.js';
import AppIcon from '../../../shared/components/AppIcon.js';
import AppLoading from '../../../shared/components/AppLoading.js';
import AppEmpty from '../../../shared/components/AppEmpty.js';

export default {
  name: 'AdminEncyclopedia',
  components: { PageHeader, AppIcon, AppLoading, AppEmpty },
  setup() {
    const ui = useUiStore();
    const entries = ref([]);
    const loading = ref(true);
    const search = ref('');
    const filterCrop = ref('');
    const filterCategory = ref('');
    const filterRisk = ref('');
    const modal = ref({ open: false, editing: null });
    const form = ref({ name_cn: '', name_en: '', crop_cn: '', category: '', risk_level: '中', symptom_summary: '', symptoms: [''], prevention: [''], treatment: [''] });

    async function load() {
      loading.value = true;
      try { entries.value = await getEncyclopediaList({}); }
      catch { entries.value = []; }
      finally { loading.value = false; }
    }

    // 数组字段动态编辑
    function addItem(field) { form.value[field].push(''); }
    function removeItem(field, idx) { if (form.value[field].length > 1) form.value[field].splice(idx, 1); }

    function openCreate() {
      form.value = { name_cn: '', name_en: '', crop_cn: '', category: '', risk_level: '中', symptom_summary: '', symptoms: [''], prevention: [''], treatment: [''] };
      formImageFile.value = null; formImagePreview.value = false;
      modal.value = { open: true, editing: null };
    }
    function openEdit(e) {
      form.value = { ...e, symptoms: [...(e.symptoms||[''])], prevention: [...(e.prevention||[''])], treatment: [...(e.treatment||[''])] };
      formImageFile.value = null; formImagePreview.value = false;
      modal.value = { open: true, editing: e.id };
    }
    function closeModal() { modal.value.open = false; }

    async function save() {
      try {
        let result;
        if (modal.value.editing) {
          result = await adminEncyclopediaUpdate(modal.value.editing, form.value);
        } else {
          result = await adminEncyclopediaCreate(form.value);
        }
        // 上传图片（如有选择）
        const diseaseId = result?.id || modal.value.editing;
        if (formImageFile.value && diseaseId) {
          const fd = new FormData();
          fd.append('file', formImageFile.value);
          await request('POST', `/api/admin/encyclopedia/${diseaseId}/image`, fd);
        }
        ui.showToast('保存成功', 'success');
        closeModal();
        load();
      } catch { ui.showToast('保存失败', 'error'); }
    }

    const confirmDelete = ref(null);
    const formImageFile = ref(null);
    const formImagePreview = ref(false);

    function onImageChange(e) {
      const file = e.target.files?.[0];
      if (file) { formImageFile.value = file; formImagePreview.value = true; }
    }

    function askDelete(e) {
      confirmDelete.value = { id: e.id, name_cn: e.name_cn };
    }
    async function doDelete() {
      if (!confirmDelete.value) return;
      try {
        await adminEncyclopediaDelete(confirmDelete.value.id);
        ui.showToast('已删除', 'success');
        confirmDelete.value = null;
        load();
      } catch { ui.showToast('删除失败', 'error'); }
    }

    // 简单汉字→拼音首字母映射（农业相关高频字）
    const PINYIN_MAP = {};
    '苹果蓝莓樱桃玉米葡萄柑橘桃甜椒马铃薯覆盆子大豆南瓜草莓番茄水稻小麦黄瓜茄豆瓜椒葱蒜姜菌霉病斑腐烂枯萎锈粉毒虫健康'.split('').forEach((c, i) => {
      const py = ['ping','guo','lan','mei','ying','tao','yu','mi','pu','tao','gan','ju','tao','tian','jiao','ma','ling','shu','fu','pen','zi','da','dou','nan','gua','cao','mei','fan','qie','shui','dao','xiao','mai','huang','gua','qie','dou','gua','jiao','cong','suan','jiang','jun','mei','bing','ban','fu','lan','ku','wei','xiu','fen','du','chong','jian','kang'][i] || '';
      PINYIN_MAP[c] = py;
    });
    function pinyinMatch(text, q) {
      if (!text || !q) return false;
      if (text.toLowerCase().includes(q.toLowerCase())) return true;
      const initials = [...text].map(c => (PINYIN_MAP[c] || '')[0] || '').join('').toLowerCase();
      const full = [...text].map(c => PINYIN_MAP[c] || c).join('').toLowerCase();
      return initials.includes(q.toLowerCase()) || full.includes(q.toLowerCase());
    }

    const filtered = computed(() => {
      let list = entries.value;
      if (filterCrop.value) list = list.filter(e => e.crop_cn === filterCrop.value);
      if (filterCategory.value) list = list.filter(e => e.category === filterCategory.value);
      if (filterRisk.value) list = list.filter(e => e.risk_level === filterRisk.value);
      if (search.value) {
        const q = search.value.trim();
        list = list.filter(e => pinyinMatch(e.name_cn, q) || (e.name_en || '').toLowerCase().includes(q.toLowerCase()));
      }
      return list;
    });

    onMounted(load);

    const crops = ['苹果','蓝莓','樱桃','玉米','葡萄','柑橘','桃','甜椒','马铃薯','覆盆子','大豆','南瓜','草莓','番茄','水稻','小麦'];
    const categories = ['真菌性病害','细菌性病害','病毒性病害','虫害','健康'];
    const risks = ['低','中','高','严重'];

    return { entries, loading, search, filterCrop, filterCategory, filterRisk, modal, form, formImageFile, formImagePreview, filtered, crops, categories, risks, openCreate, openEdit, closeModal, save, onImageChange, addItem, removeItem, remove: askDelete, confirmDelete, doDelete };
  },
  template: `
    <div>
      <page-header icon="book-open" title="百科管理" description="病害词条维护">
        <button class="btn btn-primary btn-sm" @click="openCreate"><app-icon name="plus" :size="14"></app-icon> 新增词条</button>
      </page-header>

      <div class="encyclopedia-toolbar" style="margin-bottom:16px;">
        <div class="search-box"><span class="search-icon">🔍</span><input v-model="search" placeholder="搜索病害名称（支持拼音首字母）..." style="width:100%;height:44px;padding:0 14px 0 38px;border:1px solid var(--color-border);border-radius:8px;font-size:14px;" /></div>
        <select class="form-select" v-model="filterCrop" style="width:130px;height:44px;">
          <option value="">全部作物</option>
          <option v-for="c in crops" :key="c" :value="c">{{ c }}</option>
        </select>
        <select class="form-select" v-model="filterCategory" style="width:130px;height:44px;">
          <option value="">全部分类</option>
          <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
        </select>
        <select class="form-select" v-model="filterRisk" style="width:120px;height:44px;">
          <option value="">全部风险</option>
          <option v-for="r in risks" :key="r" :value="r">{{ r }}</option>
        </select>
        <span style="font-size:12px;color:var(--color-text-hint);">{{ filtered.length }} 条结果</span>
      </div>

      <app-loading v-if="loading" text="加载百科数据..."></app-loading>
      <app-empty v-if="!loading && !filtered.length" icon="📖" title="暂无词条"></app-empty>

      <div v-if="!loading && filtered.length" class="disease-grid" style="grid-template-columns:repeat(auto-fill,minmax(280px,1fr));">
        <div v-for="e in filtered" :key="e.id" class="card" style="padding:16px;display:flex;justify-content:space-between;align-items:center;">
          <div style="flex:1;min-width:0;">
            <div style="font-weight:600;">{{ e.name_cn }} <span style="font-size:12px;color:var(--color-text-hint);">{{ e.name_en }}</span></div>
            <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap;">
              <span class="tag tag-sm tag-crop">{{ e.crop_cn || '-' }}</span>
              <span class="tag tag-sm tag-category">{{ e.category || '-' }}</span>
              <span class="tag tag-sm" :class="'tag-risk-'+(e.risk_level==='高'||e.risk_level==='严重'?'high':'mid')">{{ e.risk_level || '-' }}</span>
            </div>
          </div>
          <div style="display:flex;gap:6px;flex-shrink:0;">
            <button class="btn btn-sm btn-outline" @click="openEdit(e)"><app-icon name="edit" :size="13"></app-icon></button>
            <button class="btn btn-sm btn-danger" @click="remove(e.id)"><app-icon name="trash" :size="13"></app-icon></button>
          </div>
        </div>
      </div>

      <!-- 新增/编辑弹窗（复用已有的 modal-overlay/modal-dialog 动画） -->
      <div v-if="modal.open" class="modal-overlay" @click.self="closeModal">
        <div class="modal-dialog" style="width:600px;max-height:80vh;overflow-y:auto;">
          <button class="modal-close" @click="closeModal"><app-icon name="x" :size="14"></app-icon></button>
          <div class="modal-header">
            <div class="modal-icon"><app-icon name="book-open" :size="28"></app-icon></div>
            <h2 class="modal-title">{{ modal.editing ? '编辑词条' : '新增词条' }}</h2>
          </div>
          <div class="modal-body">
            <div class="form-group"><label class="form-label">中文名</label><input class="form-input" v-model="form.name_cn" /></div>
            <div class="form-group"><label class="form-label">英文名</label><input class="form-input" v-model="form.name_en" /></div>
            <div class="form-row" style="display:flex;gap:12px;">
              <div class="form-group" style="flex:1;"><label class="form-label">作物</label><select class="form-select" v-model="form.crop_cn"><option v-for="c in crops" :key="c" :value="c">{{ c }}</option></select></div>
              <div class="form-group" style="flex:1;"><label class="form-label">类别</label><select class="form-select" v-model="form.category"><option v-for="c in categories" :key="c" :value="c">{{ c }}</option></select></div>
              <div class="form-group" style="flex:1;"><label class="form-label">风险等级</label><select class="form-select" v-model="form.risk_level"><option v-for="r in risks" :key="r" :value="r">{{ r }}</option></select></div>
            </div>
            <div class="form-group"><label class="form-label">简要描述</label><textarea class="form-textarea" v-model="form.symptom_summary" rows="2"></textarea></div>

            <!-- 症状表现（动态数组） -->
            <div class="form-group">
              <label class="form-label" style="display:flex;align-items:center;justify-content:space-between;">
                症状表现
                <button class="btn btn-sm btn-outline" @click="addItem('symptoms')" style="font-size:11px;padding:0 8px;min-height:24px;">+ 添加</button>
              </label>
              <div v-for="(s, i) in form.symptoms" :key="'sym'+i" style="display:flex;gap:6px;margin-bottom:4px;">
                <input class="form-input" v-model="form.symptoms[i]" :placeholder="'症状 '+(i+1)" style="flex:1;height:34px;" />
                <button v-if="form.symptoms.length>1" @click="removeItem('symptoms',i)" class="btn btn-sm btn-outline" style="min-height:34px;color:var(--color-error);">✕</button>
              </div>
            </div>

            <!-- 防治方法（动态数组） -->
            <div class="form-group">
              <label class="form-label" style="display:flex;align-items:center;justify-content:space-between;">
                防治方法
                <button class="btn btn-sm btn-outline" @click="addItem('prevention')" style="font-size:11px;padding:0 8px;min-height:24px;">+ 添加</button>
              </label>
              <div v-for="(p, i) in form.prevention" :key="'prev'+i" style="display:flex;gap:6px;margin-bottom:4px;">
                <input class="form-input" v-model="form.prevention[i]" :placeholder="'防治措施 '+(i+1)" style="flex:1;height:34px;" />
                <button v-if="form.prevention.length>1" @click="removeItem('prevention',i)" class="btn btn-sm btn-outline" style="min-height:34px;color:var(--color-error);">✕</button>
              </div>
            </div>

            <!-- 治疗方法（动态数组） -->
            <div class="form-group">
              <label class="form-label" style="display:flex;align-items:center;justify-content:space-between;">
                治疗方法
                <button class="btn btn-sm btn-outline" @click="addItem('treatment')" style="font-size:11px;padding:0 8px;min-height:24px;">+ 添加</button>
              </label>
              <div v-for="(t, i) in form.treatment" :key="'trt'+i" style="display:flex;gap:6px;margin-bottom:4px;">
                <input class="form-input" v-model="form.treatment[i]" :placeholder="'治疗措施 '+(i+1)" style="flex:1;height:34px;" />
                <button v-if="form.treatment.length>1" @click="removeItem('treatment',i)" class="btn btn-sm btn-outline" style="min-height:34px;color:var(--color-error);">✕</button>
              </div>
            </div>

            <!-- 百科图片上传 -->
            <div class="form-group">
              <label class="form-label">百科图片</label>
              <div style="display:flex;align-items:center;gap:8px;">
                <input type="file" accept="image/*" @change="onImageChange" style="font-size:13px;" />
                <span v-if="formImagePreview" style="font-size:12px;color:var(--color-text-hint);">已选择</span>
              </div>
              <img v-if="form.image_url" :src="form.image_url" style="width:100%;max-height:180px;object-fit:cover;border-radius:8px;margin-top:8px;border:1px solid var(--color-border-light);" />
            </div>

            <div style="display:flex;gap:8px;margin-top:16px;">
              <button class="btn btn-primary" @click="save">保存</button>
              <button class="btn btn-outline" @click="closeModal">取消</button>
            </div>
          </div>
        </div>
      </div>

      <!-- 删除确认弹窗 -->
      <div v-if="confirmDelete" class="modal-overlay" @click.self="confirmDelete=null">
        <div class="modal-dialog" style="width:380px;">
          <div class="modal-header">
            <div class="modal-icon"><app-icon name="alert-triangle" :size="28"></app-icon></div>
            <h2 class="modal-title">确认删除</h2>
            <p class="modal-subtitle">确定要删除词条「{{ confirmDelete.name_cn }}」吗？此操作不可恢复。</p>
          </div>
          <div class="modal-body" style="display:flex;gap:8px;justify-content:center;">
            <button class="btn btn-danger" @click="doDelete">确认删除</button>
            <button class="btn btn-outline" @click="confirmDelete=null">取消</button>
          </div>
        </div>
      </div>
    </div>
  `,
};
