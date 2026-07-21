/**
 * 历史·统计页面
 * 历史记录列表 + 数据统计（子标签切换）
 */
window.makePageHistory = function () {
  const store = window.AppStore;

  return {
    data() {
      return {
        subTab: 'history',       // 'history' | 'stats'
        chart: null,
      };
    },
    computed: {
      history()    { return store.history.records; },
      statsData()  { return store.history.stats; },
      statsTotal() { return this.statsData.reduce((s, d) => s + d.value, 0); },
      statsCategories() { return this.statsData.length; },
      statsTopDisease() { return this.statsData.length ? this.statsData[0].name : '-'; },
    },
    created() {
      this.loadHistory();
    },
    methods: {
      async loadHistory() {
        try {
          store.history.records = await window.Api.getHistory();
        } catch { /* 忽略 */ }
      },
      async deleteRecord(id) {
        // 先标记为删除中（触发滑出动画）
        const record = store.history.records.find(r => r.id === id);
        if (record) record._deleting = true;
        // 动画结束后真正删除
        await new Promise(r => setTimeout(r, 400));
        try {
          await window.Api.deleteHistory(id);
          store.history.records = store.history.records.filter(r => r.id !== id);
          store.showToast('已删除', 'success');
        } catch (e) {
          // 恢复
          if (record) record._deleting = false;
          store.showToast('删除失败', 'error');
        }
      },
      goDiagnose() { window.AppRouter.navigate('diagnose'); },
      async clearAll() {
        if (!confirm('确定清空全部历史记录？')) return;
        for (const r of [...store.history.records]) {
          try { await window.Api.deleteHistory(r.id); } catch {}
        }
        store.history.records = [];
        store.history.stats = [];
        store.showToast('已清空全部记录', 'success');
      },

      // ── 统计 ──
      switchSubTab(tab) {
        this.subTab = tab;
        if (tab === 'stats') {
          this.loadStats();
        }
      },
      async loadStats() {
        try {
          store.history.stats = await window.Api.getStats();
          this.$nextTick(() => this.renderChart());
        } catch { /* 忽略 */ }
      },
      renderChart() {
        if (!this.$refs.chartDom || !this.statsData.length) return;
        if (this.chart) this.chart.dispose();
        this.chart = echarts.init(this.$refs.chartDom);

        this.chart.setOption({
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
            data: this.statsData,
          }],
          color: [
            '#2e7d32','#43a047','#66bb6a','#81c784','#a5d6a7',
            '#c8e6c9','#388e3c','#1b5e20','#4caf50','#8bc34a',
            '#558b2f','#689f38','#7cb342','#9ccc65','#aed581',
          ],
        });

        // Chart resize 防抖
        let resizeTimer = null;
        const handleResize = () => {
          if (resizeTimer) clearTimeout(resizeTimer);
          resizeTimer = setTimeout(() => this.chart?.resize(), 200);
        };
        window.addEventListener('resize', handleResize);
        this._chartResizeHandler = handleResize;
      },
      beforeUnmount() {
        if (this.chart) this.chart.dispose();
        if (this._chartResizeHandler) {
          window.removeEventListener('resize', this._chartResizeHandler);
        }
      },
    },
    template: `
      <div>
        <!-- 子标签 — 带底部指示条滑动 -->
        <div class="subtab-wrapper" style="margin-bottom:20px;border-bottom:2px solid var(--color-border-light);position:relative;">
          <button
            class="btn btn-text"
            ref="tabHistory"
            :style="{ color: subTab === 'history' ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: subTab === 'history' ? '700' : '400', fontSize: '15px', padding: '10px 24px' }"
            @click="switchSubTab('history')"
          >📋 历史记录</button>
          <button
            class="btn btn-text"
            ref="tabStats"
            :style="{ color: subTab === 'stats' ? 'var(--color-primary)' : 'var(--color-text-secondary)', fontWeight: subTab === 'stats' ? '700' : '400', fontSize: '15px', padding: '10px 24px' }"
            @click="switchSubTab('stats')"
          >📊 数据统计</button>
          <div
            class="subtab-indicator"
            :style="{ left: subTab === 'history' ? '0px' : '50%', width: '50%' }"
          ></div>
        </div>

        <!-- ═══════ 历史记录 ═══════ -->
        <div v-if="subTab === 'history'">
          <div class="card">
            <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
              <span>📋 历史诊断记录</span>
              <button
                v-if="history.length"
                class="btn btn-sm btn-outline"
                @click="clearAll"
              >🗑 清空全部</button>
            </div>

            <div v-if="history.length === 0">
              <app-empty
                icon="🍂"
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
              <button class="btn btn-sm btn-outline" style="margin-left:8px;" @click="deleteRecord(item.id)">✕</button>
            </div>
          </div>
        </div>

        <!-- ═══════ 数据统计 ═══════ -->
        <div v-if="subTab === 'stats'">
          <div class="stat-summary">
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
          </div>

          <div class="card">
            <div class="card-header">📊 病害类别分布</div>
            <div v-if="statsTotal === 0" style="text-align:center;padding:48px;color:#aaa;">
              🍂 暂无统计数据，去诊断几次吧
            </div>
            <div class="stat-chart" ref="chartDom" v-show="statsTotal > 0"></div>
          </div>
        </div>
      </div>
    `,
  };
};
