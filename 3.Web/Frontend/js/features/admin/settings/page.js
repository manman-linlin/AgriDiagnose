import { ref, computed, onMounted } from 'vue';
import {
  adminConfigLlm, adminConfigLlmUpdate, adminConfigSetActive, adminConfigLlmTest,
  adminConfigSystem, adminConfigSystemUpdate,
} from '../../../api/index.js';
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
    const activeProviderId = ref('');
    const selectedId = ref('');
    const apiKeyInput = ref('');
    const modelInput = ref('');
    const baseUrlInput = ref('');
    const saving = ref(false);
    const testing = ref(false);
    const system = ref({ maxUploadMB: 10, maxImages: 20 });

    const selectedProvider = computed(() => providers.value.find((p) => p.id === selectedId.value) || null);
    const isCustom = computed(() => selectedId.value === 'custom');
    const isActiveSelected = computed(() => !!selectedId.value && selectedId.value === activeProviderId.value);
    const activeProvider = computed(() => providers.value.find((p) => p.id === activeProviderId.value) || null);

    function loadSelection(id) {
      const p = providers.value.find((x) => x.id === id);
      if (!p) return;
      selectedId.value = id;
      apiKeyInput.value = ''; // 出于安全不回显已保存的 Key，留空 = 不修改
      modelInput.value = p.default_model || '';
      baseUrlInput.value = p.base_url || '';
    }

    async function load() {
      loading.value = true;
      try {
        const [llmData, sysData] = await Promise.all([adminConfigLlm(), adminConfigSystem()]);
        providers.value = llmData.providers;
        activeProviderId.value = llmData.active_provider || '';
        system.value = sysData;
        const initial = selectedId.value || activeProviderId.value || (providers.value[0] && providers.value[0].id) || '';
        if (initial) loadSelection(initial);
      } catch { /* 降级 */ }
      finally { loading.value = false; }
    }

    async function saveAndActivate() {
      const p = selectedProvider.value;
      if (!p) return;
      if (!apiKeyInput.value.trim() && !p.has_key) {
        ui.showToast('请填写 API Key', 'error');
        return;
      }
      if (!modelInput.value.trim()) {
        ui.showToast('请填写模型名称', 'error');
        return;
      }
      if (isCustom.value && !baseUrlInput.value.trim()) {
        ui.showToast('自定义服务商需要填写接口地址', 'error');
        return;
      }
      saving.value = true;
      try {
        const payload = { default_model: modelInput.value.trim() };
        if (apiKeyInput.value.trim()) payload.api_key = apiKeyInput.value.trim();
        if (isCustom.value) payload.base_url = baseUrlInput.value.trim();
        await adminConfigLlmUpdate(p.id, payload);
        await adminConfigSetActive(p.id);
        ui.showToast('已保存并启用', 'success');
        await load();
      } catch (e) {
        ui.showToast(e.message || '保存失败', 'error');
      } finally {
        saving.value = false;
      }
    }

    async function testConnection() {
      const p = selectedProvider.value;
      if (!p) return;
      if (!apiKeyInput.value.trim() && !p.has_key) {
        ui.showToast('请先填写 API Key 再测试', 'error');
        return;
      }
      testing.value = true;
      try {
        const data = await adminConfigLlmTest(p.id, {
          api_key: apiKeyInput.value.trim() || undefined,
          base_url: isCustom.value ? baseUrlInput.value.trim() : undefined,
        });
        ui.showToast(data.ok ? '连接成功' : `连接失败：${data.error || ('HTTP ' + data.status)}`, data.ok ? 'success' : 'error');
      } catch (e) {
        ui.showToast(e.message || '测试失败', 'error');
      } finally {
        testing.value = false;
      }
    }

    async function saveSystem() {
      try {
        await adminConfigSystemUpdate(system.value);
        ui.showToast('系统参数已保存', 'success');
      } catch {
        ui.showToast('保存失败', 'error');
      }
    }

    onMounted(load);

    return {
      loading, providers, activeProviderId, activeProvider, selectedId, selectedProvider, isCustom, isActiveSelected,
      apiKeyInput, modelInput, baseUrlInput, saving, testing, system,
      loadSelection, saveAndActivate, testConnection, saveSystem,
    };
  },
  template: `
    <div>
      <page-header icon="settings" title="系统配置" description="管理 LLM 服务商与系统参数"></page-header>
      <app-loading v-if="loading" text="加载配置..."></app-loading>

      <div v-if="!loading">
        <!-- 大模型配置 -->
        <div class="card" style="margin-bottom:16px;">
          <div class="card-header"><app-icon name="cpu" :size="16"></app-icon> 大模型配置（AI 对话 / 诊断建议）</div>

          <p style="font-size:13px;color:var(--color-text-secondary,#888);margin:0 0 14px;">
            当前生效：
            <strong v-if="activeProvider" style="color:var(--color-success);">{{ activeProvider.name }}（{{ activeProvider.default_model }}）</strong>
            <span v-else style="color:var(--color-danger,#e05252);">尚未启用任何服务商，AI 对话与诊断建议功能不可用</span>
          </p>

          <div class="form-group">
            <label class="form-label">选择服务商</label>
            <select class="form-input" v-model="selectedId" @change="loadSelection(selectedId)">
              <option v-for="p in providers" :key="p.id" :value="p.id">
                {{ p.name }}{{ p.id === activeProviderId ? '（当前使用）' : (p.has_key ? '（已配置）' : '') }}
              </option>
            </select>
          </div>

          <div class="form-group" v-if="isCustom">
            <label class="form-label">接口地址</label>
            <input class="form-input" v-model="baseUrlInput" placeholder="https://your-api.example.com/v1（OpenAI 兼容 /chat/completions 协议）" />
          </div>

          <div class="form-group">
            <label class="form-label">API Key</label>
            <input
              class="form-input" type="password" v-model="apiKeyInput"
              :placeholder="selectedProvider && selectedProvider.has_key ? ('已设置：' + selectedProvider.api_key_hint + '，留空则不修改') : '请输入 API Key'"
            />
          </div>

          <div class="form-group">
            <label class="form-label">模型</label>
            <input class="form-input" v-model="modelInput" list="llm-model-suggestions" placeholder="模型名称" />
            <datalist id="llm-model-suggestions">
              <option v-for="m in (selectedProvider ? selectedProvider.models : [])" :key="m" :value="m"></option>
            </datalist>
            <p style="font-size:12px;color:var(--color-text-secondary,#888);margin:6px 0 0;">
              诊断建议需要解析图片，请选择支持图片输入的视觉模型；纯文本模型可用于 AI 问答，但无法生成诊断开场白。
            </p>
          </div>

          <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap;">
            <span class="tag tag-sm" :class="isActiveSelected ? 'tag-status-approved' : 'tag-status-rejected'">
              {{ isActiveSelected ? '✅ 当前生效' : '未启用' }}
            </span>
            <button class="btn btn-primary" :disabled="saving" @click="saveAndActivate">
              {{ saving ? '保存中...' : '💾 保存并启用' }}
            </button>
            <button class="btn btn-outline" :disabled="testing" @click="testConnection">
              {{ testing ? '测试中...' : '测试连接' }}
            </button>
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
