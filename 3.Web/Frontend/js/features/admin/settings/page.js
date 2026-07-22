import { ref, onMounted } from 'vue';
import { adminConfigLlm, adminConfigLlmUpdate, adminConfigLlmTest, adminConfigSystem, adminConfigSystemUpdate } from '../../../api/index.js';
import { useUiStore } from '../../../stores/ui.js';
import PageHeader from '../../../shared/components/PageHeader.js';
import AppIcon from '../../../shared/components/AppIcon.js';
import AppLoading from '../../../shared/components/AppLoading.js';

export default {
  name: 'AdminSettings',
  components: { PageHeader, AppIcon, AppLoading },
  setup() {
    const ui = useUiStore();
    const loading = ref(true);
    const providers = ref([]);
    const system = ref({ maxUploadMB: 10, maxImages: 20, allowedTypes: 'jpg,jpeg,png,webp' });
    const expanded = ref(null);
    const testing = ref({});

    async function load() {
      loading.value = true;
      try {
        providers.value = await adminConfigLlm();
        system.value = await adminConfigSystem();
      } catch { /* 降级 */ }
      finally { loading.value = false; }
    }

    async function saveProvider(id) {
      const p = providers.value.find(x => x.id === id);
      if (!p) return;
      try { await adminConfigLlmUpdate(id, p); ui.showToast('已保存', 'success'); }
      catch { ui.showToast('保存失败', 'error'); }
    }

    async function testProvider(id) {
      testing.value[id] = true;
      try { await adminConfigLlmTest(id); ui.showToast('连接成功', 'success'); }
      catch { ui.showToast('连接失败', 'error'); }
      finally { testing.value[id] = false; }
    }

    async function saveSystem() {
      try { await adminConfigSystemUpdate(system.value); ui.showToast('系统参数已保存', 'success'); }
      catch { ui.showToast('保存失败', 'error'); }
    }

    onMounted(load);

    return { loading, providers, system, expanded, testing, saveProvider, testProvider, saveSystem, toggle(p) { expanded.value = expanded.value === p ? null : p; } };
  },
  template: `
    <div>
      <page-header icon="settings" title="系统配置" description="管理 LLM 服务商与系统参数"></page-header>
      <app-loading v-if="loading" text="加载配置..."></app-loading>

      <div v-if="!loading">
        <!-- LLM 服务商 -->
        <div v-for="p in providers" :key="p.id" class="card" style="margin-bottom:12px;">
          <div @click="toggle(p.id)" style="display:flex;align-items:center;justify-content:space-between;cursor:pointer;">
            <div style="display:flex;align-items:center;gap:10px;">
              <app-icon name="chevron-down" :size="14" style="transition:transform 0.2s;" :style="{transform:expanded===p.id?'rotate(180deg)':''}"></app-icon>
              <strong>{{ p.name }}</strong>
              <span class="status-dot" :style="{background:p.enabled?'var(--color-success)':'var(--color-border)',width:'8px',height:'8px',borderRadius:'50%'}"></span>
            </div>
            <span class="tag tag-sm" :class="p.enabled?'tag-status-approved':'tag-status-rejected'">{{ p.enabled ? '已启用' : '已禁用' }}</span>
          </div>
          <div :style="{maxHeight:expanded===p.id?'400px':'0',opacity:expanded===p.id?'1':'0',overflow:'hidden',transition:'max-height 0.3s ease, opacity 0.25s ease',marginTop:expanded===p.id?'12px':'0'}">
            <div class="form-group"><label class="form-label">API Key</label><input class="form-input" v-model="p.api_key" type="password" /></div>
            <div class="form-group"><label class="form-label">接口地址</label><input class="form-input" v-model="p.base_url" /></div>
            <div style="display:flex;gap:8px;align-items:center;">
              <label style="display:flex;align-items:center;gap:6px;cursor:pointer;font-size:14px;">
                <input type="checkbox" v-model="p.enabled" /> 启用
              </label>
              <button class="btn btn-sm btn-primary" @click="saveProvider(p.id)">保存</button>
              <button class="btn btn-sm btn-outline" :disabled="testing[p.id]" @click="testProvider(p.id)">{{ testing[p.id] ? '测试中...' : '测试连接' }}</button>
            </div>
          </div>
        </div>

        <!-- 系统参数 -->
        <div class="card">
          <div class="card-header"><app-icon name="server" :size="16"></app-icon> 系统参数</div>
          <div class="form-group"><label class="form-label">最大上传 (MB)</label><input class="form-input" type="number" v-model.number="system.maxUploadMB" /></div>
          <div class="form-group"><label class="form-label">单次最大图片数</label><input class="form-input" type="number" v-model.number="system.maxImages" /></div>
          <button class="btn btn-primary" @click="saveSystem">💾 保存系统参数</button>
        </div>
      </div>
    </div>
  `,
};
