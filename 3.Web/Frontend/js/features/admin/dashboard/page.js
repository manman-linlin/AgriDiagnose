import { ref, computed, onMounted, onBeforeUnmount, nextTick } from 'vue';
import { adminDashboardOverview, adminDashboardTrends, adminDashboardDistribution, getHistory, getStats } from '../../../api/index.js';
import PageHeader from '../../../shared/components/PageHeader.js';
import AppIcon from '../../../shared/components/AppIcon.js';
import AppCounter from '../../../shared/components/AppCounter.js';
import AppLoading from '../../../shared/components/AppLoading.js';
import AppError from '../../../shared/components/AppError.js';

const ECHARTS_CDN = 'https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.esm.min.js';

export default {
  name: 'AdminDashboard',
  components: { PageHeader, AppIcon, AppCounter, AppLoading, AppError },
  setup() {
    const loading = ref(true);
    const error = ref('');
    const refreshing = ref(false);
    const lastUpdated = ref('');
    const selectedDisease = ref('');
    const overview = ref({ total: 0, today: 0, users: 0, categories: 38, pending: 0, modelStatus: '正常' });
    const prevOverview = ref(null);
    const changedKeys = ref(new Set());
    const distribution = ref([]);
    const recentList = ref([]);
    const trends = ref([]);
    const cropDist = ref([]);
    const expandedRow = ref(null);
    let chartInst = null, trendChartInst = null, cropChartInst = null, histChartInst = null;
    let pollTimer = null;

    // 置信度分布分桶
    const confBuckets = computed(() => {
      const buckets = { '0-60': 0, '60-80': 0, '80-95': 0, '95-100': 0 };
      recentList.value.forEach(r => {
        const c = r.top1?.confidence || 0;
        if (c < 60) buckets['0-60']++;
        else if (c < 80) buckets['60-80']++;
        else if (c < 95) buckets['80-95']++;
        else buckets['95-100']++;
      });
      return Object.entries(buckets).map(([k, v]) => ({ name: k + '%', value: v }));
    });

    function diffOverview(newVal) {
      if (!prevOverview.value) { prevOverview.value = { ...newVal }; return new Set(); }
      const changed = new Set();
      for (const k of ['total','today','users','pending']) {
        if ((newVal[k] || 0) !== (prevOverview.value[k] || 0)) changed.add(k);
      }
      prevOverview.value = { ...newVal };
      return changed;
    }

    async function loadAll(silent = false) {
      if (!silent) { loading.value = true; error.value = ''; }
      else refreshing.value = true;
      try {
        const [ov, dist, recent, trendData, cropData] = await Promise.allSettled([
          adminDashboardOverview(), getStats(), getHistory(),
          adminDashboardTrends(30), adminDashboardDistribution()
        ]);
        if (ov.status === 'fulfilled' && ov.value) {
          const keys = diffOverview(ov.value);
          Object.assign(overview.value, ov.value);
          if (silent && keys.size) {
            changedKeys.value = keys;
            setTimeout(() => changedKeys.value = new Set(), 800);
          }
        }
        if (dist.status === 'fulfilled') distribution.value = dist.value;
        if (recent.status === 'fulfilled') recentList.value = recent.value.slice(0, 10);
        if (trendData.status === 'fulfilled') trends.value = trendData.value;
        if (cropData.status === 'fulfilled') cropDist.value = cropData.value;
        lastUpdated.value = new Date().toLocaleTimeString('zh-CN');
      } catch (e) {
        if (!silent) error.value = e.message;
      } finally {
        if (!silent) loading.value = false;
        else refreshing.value = false;
        await nextTick();
        if (distribution.value.length) renderPieChart();
        if (trends.value.length) renderTrendChart();
        if (cropDist.value.length) renderCropChart();
        renderHistChart();
      }
    }

    async function renderPieChart() {
      const dom = document.getElementById('admin-pie-chart');
      if (!dom || !distribution.value.length) return;
      try {
        const echarts = await import(/* @vite-ignore */ ECHARTS_CDN);
        if (chartInst) chartInst.dispose();
      if (trendChartInst) trendChartInst.dispose();
      if (cropChartInst) cropChartInst.dispose();
      if (histChartInst) histChartInst.dispose();
        chartInst = echarts.init(dom);
        chartInst.setOption({
          tooltip: { trigger: 'item', formatter: '{b}: {c} 次 ({d}%)' },
          legend: { type: 'scroll', orient: 'vertical', right: 10, top: 20, bottom: 20, textStyle: { fontSize: 11 } },
          series: [{
            name: '病害分布', type: 'pie',
            radius: ['40%', '70%'], center: ['40%', '50%'],
            itemStyle: { borderRadius: 4, borderColor: '#fff', borderWidth: 2 },
            label: { show: false },
            emphasis: { label: { show: true, fontSize: 14, fontWeight: 'bold' } },
            data: distribution.value,
          }],
          color: ['#2e7d32','#43a047','#66bb6a','#81c784','#a5d6a7','#c8e6c9','#388e3c','#1b5e20','#4caf50','#8bc34a','#558b2f','#689f38','#7cb342','#9ccc65','#aed581'],
        });
        // 图表-表格联动
        chartInst.off('click');
        chartInst.on('click', (params) => {
          selectedDisease.value = selectedDisease.value === params.name ? '' : params.name;
        });
      } catch { /* ECharts 加载失败静默降级 */ }
    }

    async function renderTrendChart() {
      const dom = document.getElementById('admin-trend-chart');
      if (!dom || !trends.value.length) return;
      try {
        const echarts = await import(/* @vite-ignore */ ECHARTS_CDN);
        if (trendChartInst) trendChartInst.dispose();
        trendChartInst = echarts.init(dom);
        trendChartInst.setOption({
          tooltip: { trigger: 'axis' },
          grid: { left: 40, right: 20, top: 20, bottom: 30 },
          xAxis: { type: 'category', data: trends.value.map(d => d.date.slice(5)), axisLabel: { fontSize: 11 } },
          yAxis: { type: 'value', minInterval: 1 },
          series: [{
            type: 'line', data: trends.value.map(d => d.count),
            smooth: true, lineStyle: { color: '#16A34A', width: 2 },
            areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{offset:0,color:'rgba(22,163,74,0.15)'},{offset:1,color:'rgba(22,163,74,0.02)'}] } },
            itemStyle: { color: '#16A34A' },
          }],
        });
      } catch {}
    }

    async function renderCropChart() {
      const dom = document.getElementById('admin-crop-chart');
      if (!dom || !cropDist.value.length) return;
      try {
        const echarts = await import(/* @vite-ignore */ ECHARTS_CDN);
        if (cropChartInst) cropChartInst.dispose();
        cropChartInst = echarts.init(dom);
        cropChartInst.setOption({
          tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
          grid: { left: 60, right: 40, top: 10, bottom: 20 },
          xAxis: { type: 'value' },
          yAxis: { type: 'category', data: cropDist.value.map(d => d.name).reverse(), axisLabel: { fontSize: 12 } },
          series: [{
            type: 'bar', data: cropDist.value.map(d => d.value).reverse(),
            itemStyle: { color: '#43a047', borderRadius: [0, 4, 4, 0] },
            barMaxWidth: 20,
          }],
        });
      } catch {}
    }

    async function renderHistChart() {
      const dom = document.getElementById('admin-hist-chart');
      if (!dom || !confBuckets.value.length) return;
      try {
        const echarts = await import(/* @vite-ignore */ ECHARTS_CDN);
        if (histChartInst) histChartInst.dispose();
        histChartInst = echarts.init(dom);
        const colors = ['#DC2626','#D97706','#2563EB','#16A34A'];
        histChartInst.setOption({
          tooltip: { trigger: 'axis', formatter: '{b}: {c} 次' },
          grid: { left: 40, right: 20, top: 20, bottom: 30 },
          xAxis: { type: 'category', data: confBuckets.value.map(d => d.name) },
          yAxis: { type: 'value', minInterval: 1 },
          series: [{
            type: 'bar',
            data: confBuckets.value.map((d, i) => ({ value: d.value, itemStyle: { color: colors[i], borderRadius: [6, 6, 0, 0] } })),
            barMaxWidth: 48,
          }],
        });
      } catch {}
    }

    function goTo(sub) {
      const target = '#/admin/' + sub;
      if (location.hash !== target) location.hash = target;
    }

    function exportCSV() {
      const header = '时间,作物,病害,置信度';
      const rows = recentList.value.map(r => [r.time||'', r.top1?.crop||'', r.top1?.label_cn||'', (r.top1?.confidence||0)+'%'].join(','));
      const csv = '﻿' + [header, ...rows].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = '诊断记录_' + new Date().toISOString().slice(0,10) + '.csv';
      a.click();
      URL.revokeObjectURL(a.href);
    }

    onMounted(() => {
      loadAll();
      pollTimer = setInterval(() => loadAll(true), 30000);
    });

    onBeforeUnmount(() => {
      if (pollTimer) clearInterval(pollTimer);
      if (chartInst) chartInst.dispose();
      if (trendChartInst) trendChartInst.dispose();
      if (cropChartInst) cropChartInst.dispose();
      if (histChartInst) histChartInst.dispose();
    });

    const sortKey = ref('time');
    const sortDir = ref(-1);  // -1=desc, 1=asc

    function toggleSort(key) {
      if (sortKey.value === key) { sortDir.value *= -1; }
      else { sortKey.value = key; sortDir.value = -1; }
    }

    const filteredRecent = computed(() => {
      let list = recentList.value;
      if (selectedDisease.value) {
        list = list.filter(r => r.top1 && r.top1.label_cn === selectedDisease.value);
      }
      const k = sortKey.value, d = sortDir.value;
      return [...list].sort((a, b) => {
        let va, vb;
        if (k === 'time') { va = a.time || ''; vb = b.time || ''; return d * va.localeCompare(vb); }
        if (k === 'confidence') { va = a.top1?.confidence || 0; vb = b.top1?.confidence || 0; return d * (va - vb); }
        if (k === 'disease') { va = a.top1?.label_cn || ''; vb = b.top1?.label_cn || ''; return d * va.localeCompare(vb); }
        return 0;
      });
    });

    return { loading, error, refreshing, lastUpdated, overview, selectedDisease, sortKey, sortDir, toggleSort, distribution, recentList, filteredRecent, changedKeys, trends, cropDist, expandedRow, goTo, loadAll, exportCSV };
  },
  template: `
    <div>
      <page-header icon="bar-chart" title="数据概览" description="系统运行数据总览">
        <div style="display:flex;align-items:center;gap:8px;font-size:var(--font-size-sm);color:var(--color-text-hint);">
          <span v-if="refreshing" class="status-dot" style="width:6px;height:6px;border-radius:50%;background:var(--color-primary);animation:pulse-dot 1.2s ease-in-out infinite;"></span>
          <span v-if="lastUpdated">更新于 {{ lastUpdated }}</span>
          <button class="btn btn-sm btn-outline" @click="loadAll(true)" :disabled="refreshing">刷新</button>
          <button class="btn btn-sm btn-outline" @click="exportCSV" v-if="recentList.length">导出 CSV</button>
        </div>
      </page-header>

      <app-loading v-if="loading" text="加载仪表盘数据..."></app-loading>
      <app-error v-if="error" :message="error" :retryable="true" @retry="loadAll()"></app-error>

      <div v-if="!loading && !error">
        <!-- ====== 数据概览卡片 ====== -->
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:16px;margin-bottom:24px;">

          <!-- 总诊断 -->
          <div class="dash-stat-card" :class="{ 'stat-flash': changedKeys.has('total') }" @click="goTo('review')">
            <div class="dash-stat-icon" style="background:var(--color-primary-bg);color:var(--color-primary);">
              <app-icon name="bar-chart" :size="22"></app-icon>
            </div>
            <div class="dash-stat-body">
              <div class="dash-stat-value"><app-counter :to="overview.total || 0" :duration="1000"></app-counter></div>
              <div class="dash-stat-label">总诊断</div>
            </div>
          </div>

          <!-- 今日诊断 -->
          <div class="dash-stat-card" :class="{ 'stat-flash': changedKeys.has('today') }">
            <div class="dash-stat-icon" style="background:#EFF6FF;color:var(--color-info);">
              <app-icon name="calendar" :size="22"></app-icon>
            </div>
            <div class="dash-stat-body">
              <div class="dash-stat-value"><app-counter :to="overview.today || 0" :duration="1000"></app-counter></div>
              <div class="dash-stat-label">今日诊断</div>
            </div>
          </div>

          <!-- 活跃用户 -->
          <div class="dash-stat-card" :class="{ 'stat-flash': changedKeys.has('users') }" @click="goTo('users')">
            <div class="dash-stat-icon" style="background:#F5F3FF;color:#7C3AED;">
              <app-icon name="users" :size="22"></app-icon>
            </div>
            <div class="dash-stat-body">
              <div class="dash-stat-value"><app-counter :to="overview.users || 0" :duration="1000"></app-counter></div>
              <div class="dash-stat-label">活跃用户</div>
            </div>
          </div>

          <!-- 病害类别 -->
          <div class="dash-stat-card" @click="goTo('encyclopedia')">
            <div class="dash-stat-icon" style="background:var(--color-success-bg);color:var(--color-success);">
              <app-icon name="book-open" :size="22"></app-icon>
            </div>
            <div class="dash-stat-body">
              <div class="dash-stat-value" style="font-size:26px;"><app-counter :to="overview.categories || 38" :duration="800"></app-counter></div>
              <div class="dash-stat-label">病害类别</div>
            </div>
          </div>

          <!-- 待审核 -->
          <div class="dash-stat-card" :class="{ 'stat-flash': changedKeys.has('pending') }"
            :style="{background:(overview.pending||0)>=10?'var(--color-warning-bg)':''}" @click="goTo('review')">
            <div class="dash-stat-icon" :style="{background:(overview.pending||0)>=10?'#FEF3C7':'var(--color-warning-bg)',color:'var(--color-warning)'}">
              <app-icon name="check-circle" :size="22"></app-icon>
            </div>
            <div class="dash-stat-body">
              <div class="dash-stat-value" :style="{color:(overview.pending||0)>=10?'var(--color-warning)':'',fontSize:'26px'}"><app-counter :to="overview.pending || 0" :duration="800"></app-counter></div>
              <div class="dash-stat-label">待审核</div>
            </div>
          </div>

          <!-- 模型状态 -->
          <div class="dash-stat-card">
            <div class="dash-stat-icon" :style="{background:overview.modelStatus==='训练中'?'#FEF3C7':'var(--color-success-bg)',color:overview.modelStatus==='训练中'?'var(--color-warning)':'var(--color-success)'}">
              <app-icon name="cpu" :size="22"></app-icon>
            </div>
            <div class="dash-stat-body">
              <div style="display:flex;align-items:center;justify-content:center;gap:6px;">
                <span class="status-dot" :style="{width:'7px',height:'7px',borderRadius:'50%',background:overview.modelStatus==='训练中'?'var(--color-warning)':'var(--color-success)'}"
                  :class="{ 'pulse-dot': overview.modelStatus==='训练中' }"></span>
                <span class="dash-stat-value" style="font-size:16px;font-weight:600;">{{ overview.modelStatus || '正常' }}</span>
              </div>
              <div class="dash-stat-label">模型状态</div>
            </div>
          </div>
        </div>

        <!-- 趋势 + 作物两栏图表 -->
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px;">
          <div class="card">
            <div class="card-header"><app-icon name="trending-up" :size="16"></app-icon> 诊断趋势（近30天）</div>
            <div v-if="trends.length" id="admin-trend-chart" style="width:100%;height:280px;"></div>
            <div v-else style="height:100px;display:flex;align-items:center;justify-content:center;color:var(--color-text-hint);font-size:14px;">暂无趋势数据</div>
          </div>
          <div class="card">
            <div class="card-header"><app-icon name="bar-chart" :size="16"></app-icon> 作物诊断热度</div>
            <div v-if="cropDist.length" id="admin-crop-chart" style="width:100%;height:280px;"></div>
            <div v-else style="height:100px;display:flex;align-items:center;justify-content:center;color:var(--color-text-hint);font-size:14px;">暂无分布数据</div>
          </div>
        </div>

        <!-- 置信度分布 -->
        <div class="card" style="margin-bottom:20px;">
          <div class="card-header"><app-icon name="bar-chart" :size="16"></app-icon> 置信度分布</div>
          <div id="admin-hist-chart" style="width:100%;height:240px;"></div>
        </div>

        <div class="card" style="margin-bottom:20px;">
          <div class="card-header">
            <app-icon name="bar-chart" :size="16"></app-icon> 病害类别分布
            <span v-if="selectedDisease" style="margin-left:8px;font-size:13px;font-weight:400;">
              · 已筛选: <span class="tag tag-sm tag-crop" style="cursor:pointer;" @click="selectedDisease=''">{{ selectedDisease }} ✕</span>
            </span>
          </div>
          <div v-if="distribution.length" id="admin-pie-chart" style="width:100%;height:360px;"></div>
          <app-error v-else message="暂无统计数据"></app-error>
        </div>

        <div class="card">
          <div class="card-header"><app-icon name="clock" :size="16"></app-icon> 最近诊断记录 <span style="font-weight:400;font-size:13px;color:var(--color-text-hint);">（点击饼图切片可筛选）</span></div>
          <!-- 骨架屏 -->
          <div v-if="loading" style="padding:16px;">
            <div v-for="i in 5" :key="i" style="display:flex;gap:12px;align-items:center;margin-bottom:12px;">
              <div class="skeleton-block skeleton-line" style="width:140px;"></div>
              <div class="skeleton-block" style="width:40px;height:40px;border-radius:4px;flex-shrink:0;"></div>
              <div class="skeleton-block skeleton-line" style="flex:1;"></div>
              <div class="skeleton-block skeleton-line" style="width:60px;"></div>
            </div>
          </div>

          <div class="table-wrapper" v-if="!loading && filteredRecent.length">
            <table class="data-table">
              <thead><tr>
                <th style="width:30px;"></th>
                <th @click="toggleSort('time')" style="cursor:pointer;user-select:none;">时间 {{ sortKey==='time' ? (sortDir===1 ? '▲' : '▼') : '' }}</th>
                <th>图片</th>
                <th @click="toggleSort('disease')" style="cursor:pointer;user-select:none;">诊断结果 {{ sortKey==='disease' ? (sortDir===1 ? '▲' : '▼') : '' }}</th>
                <th @click="toggleSort('confidence')" style="cursor:pointer;user-select:none;">置信度 {{ sortKey==='confidence' ? (sortDir===1 ? '▲' : '▼') : '' }}</th>
              </tr></thead>
              <tbody>
                <template v-for="r in filteredRecent" :key="r.id">
                  <tr @click="expandedRow=expandedRow===r.id?null:r.id" style="cursor:pointer;">
                    <td><span :style="{display:'inline-block',transition:'transform 0.2s',transform:expandedRow===r.id?'rotate(90deg)':''}">▶</span></td>
                    <td class="td-time">{{ r.time }}</td>
                    <td><img :src="r.image_url" style="width:40px;height:40px;border-radius:4px;object-fit:cover;" loading="lazy" /></td>
                    <td>{{ r.top1.label_cn }}</td>
                    <td><span :style="{color:r.top1.confidence>=90?'var(--color-success)':r.top1.confidence>=60?'var(--color-warning)':'var(--color-error)'}">{{ r.top1.confidence }}%</span></td>
                  </tr>
                  <tr v-if="expandedRow===r.id">
                    <td colspan="5" style="padding:16px;background:var(--color-card-alt);">
                      <div style="display:flex;gap:20px;flex-wrap:wrap;">
                        <div style="flex:1;min-width:200px;">
                          <div style="font-weight:600;margin-bottom:8px;">Top-3 候选结果</div>
                          <div v-for="(t, i) in (r.top3||[])" :key="i" style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid var(--color-border-light);">
                            <span :style="{width:'20px',height:'20px',borderRadius:'50%',background:'var(--color-primary)',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:'700',flexShrink:0}">{{ i+1 }}</span>
                            <span style="flex:1;font-size:14px;">{{ t.label_cn }}</span>
                            <div style="width:120px;"><div class="conf-bar" style="margin:0;height:6px;"><div class="conf-bar-fill" :class="t.confidence>=90?'conf-high':t.confidence>=60?'conf-mid':'conf-low'" :style="{width:t.confidence+'%'}"></div></div></div>
                            <span style="font-weight:600;font-size:14px;width:48px;text-align:right;">{{ t.confidence }}%</span>
                          </div>
                        </div>
                        <div v-if="r.advice" style="flex:1;min-width:200px;border-left:1px solid var(--color-border-light);padding-left:20px;">
                          <div style="font-weight:600;margin-bottom:8px;">AI 诊断建议</div>
                          <div style="font-size:13px;color:var(--color-text-secondary);"><strong>病害:</strong> {{ r.advice.disease_name }}</div>
                          <div style="font-size:13px;color:var(--color-text-secondary);"><strong>风险:</strong> {{ r.advice.risk_level }}</div>
                          <div style="font-size:13px;color:var(--color-text-secondary);" v-if="r.advice.symptoms"><strong>症状:</strong> {{ r.advice.symptoms }}</div>
                        </div>
                      </div>
                    </td>
                  </tr>
                </template>
              </tbody>
            </table>
          </div>
          <app-error v-if="!loading && !filteredRecent.length" message="暂无诊断记录"></app-error>
        </div>
      </div>
    </div>
  `,
};
