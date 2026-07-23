import { ref, computed, onMounted, onBeforeUnmount } from 'vue';
import { getContributeList, getContributeStats, adminReview, adminBatchReview } from '../../../api/index.js';
import { useUiStore } from '../../../stores/ui.js';
import PageHeader from '../../../shared/components/PageHeader.js';
import AppIcon from '../../../shared/components/AppIcon.js';
import AppLoading from '../../../shared/components/AppLoading.js';
import AppEmpty from '../../../shared/components/AppEmpty.js';

/** 中英文映射（仅用于百科跳转） */
let CLASS_MAP = {};

async function loadClassMap() {
  try {
    const res = await fetch('/model-data/class_labels.json');
    const list = await res.json();
    CLASS_MAP = {};
    list.forEach(item => { CLASS_MAP[item.en] = item; });
  } catch { /* 静默降级 */ }
}

/** 获取显示用中文名（后端 list_contributions 已返回 label_cn） */
function displayName(item) {
  return item.label_cn || item.cn || cnNameFallback(item);
}
function cnNameFallback(item) {
  if (item.mode === 'new' || item.crop_name) {
    return (item.crop_name || '') + ' — ' + (item.disease_name || '');
  }
  const cls = CLASS_MAP[item.existing_class];
  return cls ? cls.cn + '（' + cls.crop + ' · ' + cls.disease + '）' : (item.existing_class || '未知病害');
}

/** 扩展模式下获取完整信息文本（中文名 + 作物） */
function extendedInfo(item) {
  if (item.mode === 'new') return (item.crop_name || '') + ' — ' + (item.disease_name || '');
  return (item.label_cn || item.cn || '') + (item.crop_cn ? ' （' + item.crop_cn + '）' : '');
}

export default {
  name: 'AdminReview',
  components: { PageHeader, AppIcon, AppLoading, AppEmpty },
  setup() {
    const ui = useUiStore();
    const items = ref([]);
    const loading = ref(true);
    const filter = ref('pending');
    const selected = ref(new Set());
    const lightbox = ref({ open: false, images: [], index: 0 });
    const reviewNotes = ref({});
    const actionLoading = ref({});     // 按钮三态: { 'approve-xxx': true, 'reject-xxx': true }
    const successFlash = ref({});      // 操作成功闪烁: { 'approve-xxx': true }
    const hoverPreview = ref({ show: false, src: '', x: 0, y: 0 });  // hover 预览

    // #1 审核统计概览
    const stats = ref({ total_submissions: 0, pending_count: 0, approved: 0, rejected: 0 });
    async function loadStats() {
      try { Object.assign(stats.value, await getContributeStats()); } catch {}
    }

    // #9 撤销状态 + #2 快捷键聚焦
    const undoAction = ref(null);
    const focusIndex = ref(-1);

    async function loadList() {
      loading.value = true;
      try { items.value = await getContributeList(filter.value === 'all' ? '' : filter.value); }
      catch { items.value = []; }
      finally { loading.value = false; }
    }

    function toggleSelect(id) {
      const s = new Set(selected.value);
      s.has(id) ? s.delete(id) : s.add(id);
      selected.value = s;
    }

    function selectAll() {
      selected.value = new Set(items.value.map(i => i.id));
    }
    function invertSelection() {
      const s = new Set();
      items.value.forEach(i => {
        if (!selected.value.has(i.id)) s.add(i.id);
      });
      selected.value = s;
    }
    function clearSelection() { selected.value = new Set(); }

    function setUndo(id, type) {
      if (undoAction.value?.timer) clearTimeout(undoAction.value.timer);
      const timer = setTimeout(() => { undoAction.value = null; }, 30000);
      undoAction.value = { id, type, timer };
    }
    async function undo() {
      if (!undoAction.value) return;
      const { id, timer } = undoAction.value;
      clearTimeout(timer);
      undoAction.value = null;
      try {
        await adminReview(id, false, '');  // 回退到 pending
        ui.showToast('已撤销', 'info');
        loadList(); loadStats();
      } catch { ui.showToast('撤销失败', 'error'); }
    }

    async function approve(id) {
      const key = 'approve-' + id;
      actionLoading.value[key] = true;
      try {
        await adminReview(id, true, reviewNotes.value[id] || '');
        successFlash.value[key] = true;
        setTimeout(() => { delete successFlash.value[key]; }, 800);
        setUndo(id, 'approve');
        ui.showToast('已采纳，30秒内可撤销', 'success', 4000);
        loadList(); loadStats();
      } catch (e) {
        ui.showToast(e.message || '操作失败', 'error');
      } finally {
        delete actionLoading.value[key];
      }
    }
    async function reject(id) {
      const key = 'reject-' + id;
      actionLoading.value[key] = true;
      try {
        await adminReview(id, false, reviewNotes.value[id] || '');
        successFlash.value[key] = true;
        setTimeout(() => { delete successFlash.value[key]; }, 800);
        setUndo(id, 'reject');
        ui.showToast('已驳回，30秒内可撤销', 'warning', 4000);
        loadList(); loadStats();
      } catch (e) {
        ui.showToast(e.message || '操作失败', 'error');
      } finally {
        delete actionLoading.value[key];
      }
    }
    async function batchApprove() {
      const ids = [...selected.value];
      if (!ids.length) return;
      try {
        await adminBatchReview(ids, true, '');
        ui.showToast('批量采纳完成', 'success');
        selected.value = new Set();
        loadList();
      } catch (e) {
        ui.showToast(e.message || '操作失败', 'error');
      }
    }
    async function batchReject() {
      const ids = [...selected.value];
      if (!ids.length) return;
      try {
        await adminBatchReview(ids, false, '');
        ui.showToast('批量驳回完成', 'warning');
        selected.value = new Set();
        loadList();
      } catch (e) {
        ui.showToast(e.message || '操作失败', 'error');
      }
    }

    /** hover 预览 */
    let hoverTimer = null;
    function showHoverPreview(e, src) {
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => {
        hoverPreview.value = { show: true, src, x: e.clientX + 16, y: e.clientY - 100 };
      }, 200);
    }
    function hideHoverPreview() {
      clearTimeout(hoverTimer);
      hoverPreview.value.show = false;
    }

    /** 跳转到百科并自动打开对应病害详情 */
    function openEncyclopedia(enClass) {
      if (!enClass) return;
      sessionStorage.setItem('encyclopedia_focus', enClass);
      location.hash = '#/encyclopedia';
    }

    /** Lightbox */
    function openLightbox(images, idx) {
      lightbox.value = { open: true, images, index: idx };
    }
    function closeLightbox() { lightbox.value.open = false; }
    function prevImage() {
      if (lightbox.value.index > 0) lightbox.value.index--;
    }
    function nextImage() {
      if (lightbox.value.index < lightbox.value.images.length - 1) lightbox.value.index++;
    }

    const statusLabel = (s) => ({ pending: '待审核', approved: '已采纳', rejected: '已驳回' }[s] || s);
    const statusClass = (s) => ({ pending: 'tag-status-pending', approved: 'tag-status-approved', rejected: 'tag-status-rejected' }[s] || '');

    // #2 快捷键
    function handleKeydown(e) {
      if (lightbox.value.open || undoAction.value) return;
      const key = e.key.toLowerCase();
      if (key === 'a' && focusIndex.value >= 0) { e.preventDefault(); approve(items.value[focusIndex.value]?.id); }
      else if (key === 'r' && focusIndex.value >= 0) { e.preventDefault(); reject(items.value[focusIndex.value]?.id); }
      else if (key === 'j' || key === 'arrowdown') { e.preventDefault(); focusIndex.value = Math.min(focusIndex.value + 1, items.value.length - 1); }
      else if (key === 'k' || key === 'arrowup') { e.preventDefault(); focusIndex.value = Math.max(focusIndex.value - 1, 0); }
      else if (key === ' ') { e.preventDefault(); if (focusIndex.value >= 0) toggleSelect(items.value[focusIndex.value]?.id); }
      else if (key === 'a' && e.ctrlKey) { e.preventDefault(); selectAll(); }
    }

    onMounted(async () => {
      await loadClassMap();
      loadList();
      loadStats();
      window.addEventListener('keydown', handleKeydown);
    });

    onBeforeUnmount(() => {
      window.removeEventListener('keydown', handleKeydown);
      if (undoAction.value?.timer) clearTimeout(undoAction.value.timer);
    });

    return {
      items, loading, filter, selected, lightbox, reviewNotes, actionLoading, successFlash, hoverPreview,
      stats, undoAction, focusIndex, loadList, loadStats,
      toggleSelect, selectAll, invertSelection, clearSelection, approve, reject, undo, batchApprove, batchReject,
      openLightbox, closeLightbox, prevImage, nextImage,
      showHoverPreview, hideHoverPreview, openEncyclopedia,
      statusLabel, statusClass, displayName, CLASS_MAP,
    };
  },
  template: `
    <div>
      <page-header icon="check-circle" title="审核管理" description="审核用户提交的图片数据">
        <span class="tag tag-md" :class="'tag-status-pending'">待审核 {{ items.filter(i=>i.status==='pending').length }}</span>
      </page-header>

      <!-- #1 统计概览卡片 -->
      <div class="stats-mini-row" style="margin-bottom:16px;">
        <div class="stats-mini-card" :style="{borderLeft:'3px solid var(--color-primary)'}">
          <div class="stats-mini-num">{{ stats.total_submissions || 0 }}</div>
          <div class="stats-mini-label">总提交</div>
        </div>
        <div class="stats-mini-card" :style="{borderLeft:'3px solid var(--color-warning)'}">
          <div class="stats-mini-num" style="color:var(--color-warning);">{{ stats.pending_count || 0 }}</div>
          <div class="stats-mini-label">待审核</div>
        </div>
        <div class="stats-mini-card" :style="{borderLeft:'3px solid var(--color-success)'}">
          <div class="stats-mini-num" style="color:var(--color-success);">{{ stats.approved || 0 }}</div>
          <div class="stats-mini-label">已采纳</div>
        </div>
        <div class="stats-mini-card" :style="{borderLeft:'3px solid var(--color-error)'}">
          <div class="stats-mini-num" style="color:var(--color-error);">{{ stats.rejected || 0 }}</div>
          <div class="stats-mini-label">已驳回</div>
        </div>
      </div>

      <div style="display:flex;gap:8px;margin-bottom:16px;flex-wrap:wrap;">
        <button v-for="f in [{k:'all',l:'全部'},{k:'pending',l:'待审核'},{k:'approved',l:'已采纳'},{k:'rejected',l:'已驳回'}]" :key="f.k"
          class="btn btn-sm" :class="filter===f.k?'btn-primary':'btn-outline'" @click="filter=f.k;loadList()">{{ f.l }}</button>
      </div>

      <!-- #9 撤销操作栏 -->
      <div v-if="undoAction" style="background:var(--color-warning-bg);border:1px solid var(--color-warning);border-radius:8px;padding:10px 16px;margin-bottom:12px;display:flex;align-items:center;gap:12px;">
        <app-icon name="alert-triangle" :size="16"></app-icon>
        <span style="font-size:14px;">上次操作可在 30 秒内撤销</span>
        <button class="btn btn-sm btn-warning" @click="undo">撤销</button>
        <button class="btn btn-sm btn-outline" @click="undoAction=null">忽略</button>
      </div>

      <!-- #2 快捷键提示 -->
      <div style="display:flex;gap:16px;align-items:center;font-size:11px;color:var(--color-text-hint);margin-bottom:8px;">
        <span><kbd style="background:var(--color-bg);padding:1px 5px;border-radius:3px;border:1px solid var(--color-border);">A</kbd> 采纳</span>
        <span><kbd style="background:var(--color-bg);padding:1px 5px;border-radius:3px;border:1px solid var(--color-border);">R</kbd> 驳回</span>
        <span><kbd style="background:var(--color-bg);padding:1px 5px;border-radius:3px;border:1px solid var(--color-border);">J</kbd>/<kbd style="background:var(--color-bg);padding:1px 5px;border-radius:3px;border:1px solid var(--color-border);">K</kbd> 上下移动</span>
        <span><kbd style="background:var(--color-bg);padding:1px 5px;border-radius:3px;border:1px solid var(--color-border);">Space</kbd> 选择</span>
      </div>

      <app-loading v-if="loading" text="加载审核列表..."></app-loading>
      <app-empty v-if="!loading && !items.length" icon="📋" title="暂无审核记录"></app-empty>

      <div v-if="!loading && items.length">
        <!-- 批量操作 + 全选 -->
        <div v-if="selected.size" style="position:sticky;top:0;z-index:10;background:var(--color-card);padding:12px 16px;border-radius:8px;border:1px solid var(--color-border);display:flex;align-items:center;gap:12px;margin-bottom:12px;box-shadow:var(--shadow-md);">
          <span style="font-weight:600;">已选 {{ selected.size }} 条</span>
          <button class="btn btn-sm btn-success" @click="batchApprove">采纳选中</button>
          <button class="btn btn-sm btn-danger" @click="batchReject">驳回选中</button>
          <button class="btn btn-sm btn-outline" @click="clearSelection">取消选择</button>
        </div>

        <div style="display:flex;gap:8px;margin-bottom:12px;align-items:center;">
          <button class="btn btn-sm btn-outline" @click="selectAll">全选</button>
          <button class="btn btn-sm btn-outline" @click="invertSelection">反选</button>
          <span style="font-size:12px;color:var(--color-text-hint);">{{ selected.size ? selected.size + '/' + items.length : items.length + ' 条' }}</span>
        </div>

        <div v-for="(item, idx) in items" :key="item.id" class="card"
          :style="{marginBottom:'12px',padding:'16px',borderLeft:focusIndex===idx?'3px solid var(--color-primary)':'1px solid var(--color-border-light)'}"
          @click="focusIndex=idx">
          <div style="display:flex;align-items:flex-start;gap:14px;">
            <input type="checkbox" :checked="selected.has(item.id)" @change="toggleSelect(item.id)" style="margin-top:4px;" />
            <div style="flex:1;min-width:0;">
              <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px;">
                <span style="font-size:13px;color:var(--color-text-hint);">{{ item.submit_time || item.time || item.created_at || '-' }}</span>
                <span class="tag tag-sm" :class="statusClass(item.status)">{{ statusLabel(item.status) }}</span>
                <span class="tag tag-sm tag-crop">{{ item.mode === 'new' ? '新增' : '扩展' }}</span>
              </div>
              <div style="font-weight:600;margin-bottom:4px;display:flex;align-items:center;gap:8px;">
                <span>{{ displayName(item) }}</span>
                <button v-if="item.mode==='extend' && item.existing_class"
                  class="btn btn-sm btn-outline" style="font-size:11px;padding:0 8px;min-height:24px;"
                  @click="openEncyclopedia(item.existing_class)" title="查看百科词条">
                  百科
                </button>
              </div>
              <div style="font-size:13px;color:var(--color-text-hint);margin-bottom:8px;" v-if="item.notes || item.location || item.photo_date">
                <span v-if="item.location">📍 {{ item.location }}</span>
                <span v-if="item.photo_date"> 📅 {{ item.photo_date }}</span>
                <span v-if="item.notes"> 📝 {{ item.notes }}</span>
              </div>
              <div style="display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap;">
                <img v-for="(img, i) in (item.images||[]).slice(0,6)" :key="i"
                  :src="img" @click="openLightbox(item.images, i)"
                  @mouseenter="showHoverPreview($event, img)" @mouseleave="hideHoverPreview"
                  style="width:72px;height:72px;object-fit:cover;border-radius:6px;cursor:pointer;border:2px solid var(--color-border-light);"
                  title="点击查看大图 | 悬停预览" />
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <input class="form-input" v-model="reviewNotes[item.id]" placeholder="审核意见（选填）" style="flex:1;height:36px;font-size:13px;" />
                <button class="btn btn-sm" :class="successFlash['approve-'+item.id]?'btn-submit-success':'btn-success'"
                  :disabled="actionLoading['approve-'+item.id]" @click="approve(item.id)">
                  {{ actionLoading['approve-'+item.id] ? '采纳中...' : '采纳' }}
                </button>
                <button class="btn btn-sm btn-danger"
                  :disabled="actionLoading['reject-'+item.id]" @click="reject(item.id)">
                  {{ actionLoading['reject-'+item.id] ? '驳回中...' : '驳回' }}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- hover 预览浮层 -->
      <div v-if="hoverPreview.show"
        :style="{position:'fixed',left:hoverPreview.x+'px',top:hoverPreview.y+'px',zIndex:350,pointerEvents:'none'}"
        style="background:var(--color-card);border:1px solid var(--color-border);border-radius:8px;padding:6px;box-shadow:var(--shadow-lg);">
        <img :src="hoverPreview.src" style="width:280px;max-height:280px;object-fit:contain;border-radius:4px;display:block;" />
      </div>

      <!-- Lightbox -->
      <div v-if="lightbox.open" @click.self="closeLightbox"
        style="position:fixed;top:0;left:0;right:0;bottom:0;z-index:400;background:rgba(15,23,42,0.92);display:flex;align-items:center;justify-content:center;">
        <button @click="closeLightbox"
          style="position:absolute;top:16px;right:16px;width:40px;height:40px;border-radius:50%;background:rgba(255,255,255,0.15);border:none;color:#fff;font-size:20px;cursor:pointer;">✕</button>
        <button v-if="lightbox.index > 0" @click="prevImage"
          style="position:absolute;left:20px;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.12);border:none;color:#fff;font-size:24px;cursor:pointer;">‹</button>
        <img :src="lightbox.images[lightbox.index]"
          style="max-width:85vw;max-height:80vh;border-radius:8px;box-shadow:0 8px 40px rgba(0,0,0,0.5);object-fit:contain;" />
        <button v-if="lightbox.index < lightbox.images.length - 1" @click="nextImage"
          style="position:absolute;right:20px;top:50%;transform:translateY(-50%);width:44px;height:44px;border-radius:50%;background:rgba(255,255,255,0.12);border:none;color:#fff;font-size:24px;cursor:pointer;">›</button>
        <div style="position:absolute;bottom:24px;left:50%;transform:translateX(-50%);color:rgba(255,255,255,0.6);font-size:14px;">
          {{ lightbox.index + 1 }} / {{ lightbox.images.length }}
        </div>
      </div>
    </div>
  `,
};
