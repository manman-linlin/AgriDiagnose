import { ref, onMounted, nextTick } from 'vue';
import { request } from '../../../api/client.js';
import PageHeader from '../../../shared/components/PageHeader.js';
import AppIcon from '../../../shared/components/AppIcon.js';
import AppLoading from '../../../shared/components/AppLoading.js';
import AppEmpty from '../../../shared/components/AppEmpty.js';

export default {
  name: 'AdminLogs',
  components: { PageHeader, AppIcon, AppLoading, AppEmpty },
  setup() {
    const loading = ref(false);
    const lines = ref([]);
    const level = ref('');
    const keyword = ref('');

    async function load() {
      loading.value = true;
      try {
        const params = new URLSearchParams();
        if (level.value) params.set('level', level.value);
        if (keyword.value) params.set('keyword', keyword.value);
        params.set('limit', '200');
        const data = await request('GET', '/api/admin/logs?' + params.toString());
        lines.value = data || [];
        await nextTick();
        scrollToBottom();
      } catch {
        lines.value = [];
      } finally {
        loading.value = false;
      }
    }

    function scrollToBottom() {
      const el = document.getElementById('log-container');
      if (el) el.scrollTop = el.scrollHeight;
    }

    function getLineStyle(line) {
      const upper = (line || '').toUpperCase();
      if (upper.includes('[ERROR') || upper.includes('ERROR')) return { color: '#F87171' };
      if (upper.includes('[WARN') || upper.includes('WARN'))  return { color: '#FBBF24' };
      return {};
    }

    function clearLogs() {
      lines.value = [];
    }

    onMounted(load);

    return { loading, lines, level, keyword, load, getLineStyle, clearLogs };
  },
  template: `
    <div>
      <page-header icon="terminal" title="系统日志" description="查看后端运行日志">
        <button class="btn btn-sm btn-outline" @click="load" :disabled="loading">🔄 刷新</button>
      </page-header>

      <div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap;">
        <select class="form-select" v-model="level" @change="load" style="width:120px;height:38px;">
          <option value="">全部</option>
          <option value="INFO">INFO</option>
          <option value="WARN">WARN</option>
          <option value="ERROR">ERROR</option>
        </select>
        <div style="flex:1;min-width:160px;position:relative;">
          <span style="position:absolute;left:10px;top:50%;transform:translateY(-50%);font-size:13px;color:var(--color-text-hint);">🔍</span>
          <input class="form-input" v-model="keyword" @keyup.enter="load" placeholder="搜索关键词..." style="width:100%;height:38px;padding:0 12px 0 34px;" />
        </div>
      </div>

      <app-loading v-if="loading" text="加载日志..."></app-loading>
      <app-empty v-if="!loading && !lines.length" icon="📄" title="暂无日志"></app-empty>

      <div v-if="!loading && lines.length" id="log-container"
        style="background:#1a1d23;color:#a8b8c8;font-family:'Cascadia Code','Fira Code','Consolas',monospace;font-size:12px;padding:14px;border-radius:8px;max-height:calc(100vh - 260px);overflow:auto;line-height:1.7;">
        <div v-for="(l, i) in lines" :key="i" :style="[getLineStyle(l.line), {whiteSpace:'pre'}]">
          {{ l.line }}
        </div>
      </div>
    </div>
  `,
};
