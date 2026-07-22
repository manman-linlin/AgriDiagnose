/**
 * 历史·统计页面 — 历史记录列表 + 数据统计（子标签切换）
 *
 * 相比旧版修复了一个内存泄漏 bug：原来 beforeUnmount 被误写在 methods 里，
 * 从未被 Vue 当作生命周期钩子调用，导致 echarts 实例和 resize 监听器每次
 * 切走本页都不会被清理。这里用 onBeforeUnmount 在 setup 顶层正确注册。
 * echarts 改为仅在用户打开"数据统计"子标签时才动态 import，减少首屏体积。
 */
import { ref, computed, onBeforeUnmount, nextTick } from 'vue';
import { useHistoryStore } from '../../stores/history.js';
import { useUiStore } from '../../stores/ui.js';
import { navigate } from '../../router/index.js';
import { getHistory, deleteHistory, getStats } from '../../api/index.js';
import AppEmpty from '../../shared/components/AppEmpty.js';
import AppCounter from '../../shared/components/AppCounter.js';
import AppIcon from '../../shared/components/AppIcon.js';
import PageHeader from '../../shared/components/PageHeader.js';

const ECHARTS_CDN = 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.esm.min.js';

export default {
  name: 'PageHistory',
  components: { AppEmpty, AppCounter, AppIcon, PageHeader },
  setup() {
    const store = useHistoryStore();
    const ui = useUiStore();

    const subTab = ref('history');
    const chartDom = ref(null);
    let chart = null;
    let resizeHandler = null;
    let resizeTimer = null;

    const history = computed(() => store.state.records);
    const statsData = computed(() => store.state.stats);
    const statsTotal = computed(() => statsData.value.reduce((s, d) => s + d.value, 0));
    const statsCategories = computed(() => statsData.value.length);
    const statsTopDisease = computed(() => (statsData.value.length ? statsData.value[0].name : '-'));

    async function loadHistory() {
      try {
        store.state.records = await getHistory();
      } catch { /* 忽略 */ }
    }

    async function deleteRecord(id) {
      // 先标记为删除中（触发滑出动画）
      const record = store.state.records.find(r => r.id === id);
      if (record) record._deleting = true;
      await new Promise(r => setTimeout(r, 400));
      try {
        await deleteHistory(id);
        store.state.records = store.state.records.filter(r => r.id !== id);
        ui.showToast('已删除', 'success');
      } catch {
        if (record) record._deleting = false;
        ui.showToast('删除失败', 'error');
      }
    }

    function goDiagnose() { navigate('diagnose'); }

    async function clearAll() {
      if (!confirm('确定清空全部历史记录？')) return;
      for (const r of [...store.state.records]) {
        try { await deleteHistory(r.id); } catch { /* 忽略单条失败 */ }
      }
      store.state.records = [];
      store.state.stats = [];
      ui.showToast('已清空全部记录', 'success');
    }

    async function renderChart() {
      if (!chartDom.value || !statsData.value.length) return;
      const echarts = await import(/* @vite-ignore */ ECHARTS_CDN);
      if (chart) chart.dispose();
      chart = echarts.init(chartDom.value);

      chart.setOption({
        tooltip: {
          trigger: 'item',
          formatter: '{b}: {c} 次 ({d}%)',
        },
        legend: {
          type: 'scroll', orient: 'vertical',
          right: 10, top: 20, bottom: 20,
          textStyle: { fontSize: 12 },
        },
        series: [{
          name: '病害分布',
          type: 'pie',
          radius: ['45%', '75%'],
          center: ['35%', '50%'],
          avoidLabelOverlap: false,
          itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
          label: { show: false },
          emphasis: { label: { show: true, fontSize: 16, fontWeight: 'bold' } },
          data: statsData.value,
        }],
        color: [
          '#2e7d32', '#43a047', '#66bb6a', '#81c784', '#a5d6a7',
          '#c8e6c9', '#388e3c', '#1b5e20', '#4caf50', '#8bc34a',
          '#558b2f', '#689f38', '#7cb342', '#9ccc65', '#aed581',
        ],
      });

      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
      resizeHandler = () => {
        if (resizeTimer) clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => chart && chart.resize(), 200);
      };
      window.addEventListener('resize', resizeHandler);
    }

    async function loadStats() {
      try {
        store.state.stats = await getStats();
        nextTick(() => renderChart());
      } catch { /* 忽略 */ }
    }

    function switchSubTab(tab) {
      subTab.value = tab;
      if (tab === 'stats') {
        loadStats();
      }
    }

    loadHistory();

    onBeforeUnmount(() => {
      if (chart) chart.dispose();
      if (resizeTimer) clearTimeout(resizeTimer);
      if (resizeHandler) window.removeEventListener('resize', resizeHandler);
    });

    return {
      subTab, chartDom,
      history, statsData, statsTotal, statsCategories, statsTopDisease,
      deleteRecord, goDiagnose, clearAll, switchSubTab,
    };
  },
  template: `
    <div>
      <page-header
        icon="clipboard"
        title="历史 · 统计"
        description="查看历史诊断记录，或切换到数据统计了解病害类别分布趋势"
      ></page-header>

      <!-- 子标签 — 带底部指示条滑动 -->
      <div class="subtab-wrapper" style="margin-bottom:20px;border-bottom:2px solid var(--color-border-light);position:relative;">
        <button
          class="btn btn-text"
          :style="{ color: subTab === 'history' ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: subTab === 'history' ? '700' : '400', fontSize: '15px', padding: '10px 24px' }"
          @click="switchSubTab('history')"
        ><app-icon name="clipboard" :size="15"></app-icon> 历史记录</button>
        <button
          class="btn btn-text"
          :style="{ color: subTab === 'stats' ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: subTab === 'stats' ? '700' : '400', fontSize: '15px', padding: '10px 24px' }"
          @click="switchSubTab('stats')"
        ><app-icon name="bar-chart" :size="15"></app-icon> 数据统计</button>
        <div
          class="subtab-indicator"
          :style="{ left: subTab === 'history' ? '0px' : '50%', width: '50%' }"
        ></div>
      </div>

      <!-- ═══════ 历史记录 ═══════ -->
      <div v-if="subTab === 'history'">
        <div class="card">
          <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
            <span style="display:flex;align-items:center;gap:8px;"><app-icon name="clipboard"></app-icon> 历史诊断记录</span>
            <button
              v-if="history.length"
              class="btn btn-sm btn-outline"
              @click="clearAll"
            ><app-icon name="trash" :size="13"></app-icon> 清空全部</button>
          </div>

          <div v-if="history.length === 0">
            <app-empty
              icon="inbox"
              title="暂无诊断记录"
              description="开始一次诊断来查看结果吧"
              action-label="前往诊断"
              @action="goDiagnose"
            ></app-empty>
          </div>

          <div v-for="(item, idx) in history" :key="item.id" class="history-item stagger-item" :class="{ 'history-leave-to': item._deleting }" :style="{ '--i': idx }">
            <img
              class="history-thumb"
              :src="item.image_url"
              :alt="item.top1.label_cn"
              loading="lazy"
              @error="$event.target.style.display='none'"
            />
            <div class="history-info">
              <div class="history-label">{{ item.top1.label_cn }}</div>
              <div class="history-meta">
                {{ item.time }} · {{ item.top1.crop }} · {{ item.filename }}
              </div>
            </div>
            <div class="history-score">{{ item.top1.confidence }}%</div>
            <button class="btn btn-sm btn-outline" style="margin-left:8px;" @click="deleteRecord(item.id)"><app-icon name="x" :size="12"></app-icon></button>
          </div>
        </div>
      </div>

      <!-- ═══════ 数据统计 ═══════ -->
      <div v-if="subTab === 'stats'">
        <div class="dashboard-grid">
          <div class="card">
            <div class="card-header"><app-icon name="bar-chart"></app-icon> 病害类别分布</div>
            <div v-if="statsTotal === 0" style="text-align:center;padding:48px;color:#aaa;">
              <div style="display:flex;justify-content:center;margin-bottom:8px;"><app-icon name="inbox" :size="32"></app-icon></div>
              暂无统计数据，去诊断几次吧
            </div>
            <div class="stat-chart" ref="chartDom" v-show="statsTotal > 0"></div>
          </div>

          <aside class="dashboard-aside">
            <div class="stat-box stagger-item" :style="{ '--i': 0 }">
              <div class="stat-num"><app-counter :to="statsTotal" :duration="1200"></app-counter></div>
              <div class="stat-txt">总诊断次数</div>
            </div>
            <div class="stat-box stagger-item" :style="{ '--i': 1 }">
              <div class="stat-num"><app-counter :to="statsCategories" :duration="1000"></app-counter></div>
              <div class="stat-txt">涉及病害种类</div>
            </div>
            <div class="stat-box">
              <div class="stat-num" style="font-size:20px;">{{ statsTopDisease }}</div>
              <div class="stat-txt">最常见病害</div>
            </div>
          </aside>
        </div>
      </div>
    </div>
  `,
};
