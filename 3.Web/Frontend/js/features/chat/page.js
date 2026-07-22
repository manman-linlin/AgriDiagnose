/**
 * AI 智能诊断对话页面 — 消息 staggered 入场、逐字输出、按钮状态、手风琴面板
 */
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue';
import { useDiagnosisStore } from '../../stores/diagnosis.js';
import { useChatStore } from '../../stores/chat.js';
import { useUiStore } from '../../stores/ui.js';
import { navigate } from '../../router/index.js';
import { predict, startChat } from '../../api/index.js';
import { useChatStream } from './composables/useChatStream.js';
import AdviceCard from './components/AdviceCard.js';
import AppIcon from '../../shared/components/AppIcon.js';

export default {
  name: 'PageChat',
  components: { AdviceCard, AppIcon },
  setup() {
    const diagnosisStore = useDiagnosisStore();
    const chatStore = useChatStore();
    const ui = useUiStore();

    const inputText = ref('');
    const panelExpanded = ref(false);
    const pendingImage = ref(null);
    const pendingImageUrl = ref(null);
    const chatBody = ref(null);
    const fileInput = ref(null);

    const { loading, typingText, typingMsgIdx, openStream, closeStream } = useChatStream(
      chatStore.state,
      { onToast: (msg, type) => ui.showToast(msg, type) }
    );

    const diagnosis = computed(() => diagnosisStore.state.result);
    const messages = computed(() => chatStore.state.messages);
    const hasDiagnosis = computed(() => diagnosisStore.state.status === 'done' && !!diagnosisStore.state.result);

    const quickQuestions = computed(() => {
      if (!hasDiagnosis.value) return [];
      const d = diagnosisStore.state.result.top1;
      return [
        `"${d.label_cn}"用什么药效果最好？`,
        `"${d.label_cn}"一般多久能治好？`,
        `如何预防"${d.label_cn}"复发？`,
        `这个季节容易得"${d.label_cn}"吗？`,
      ];
    });

    const confClass = computed(() => {
      const v = diagnosis.value?.top1?.confidence || 0;
      if (v >= 90) return 'high';
      if (v >= 60) return 'mid';
      return 'low';
    });
    const confLabel = computed(() => {
      const v = diagnosis.value?.top1?.confidence || 0;
      if (v >= 90) return '高置信度';
      if (v >= 60) return '中置信度';
      return '低置信度';
    });
    const confIcon = computed(() => {
      const v = diagnosis.value?.top1?.confidence || 0;
      if (v >= 90) return 'check-circle';
      if (v >= 60) return 'alert-triangle';
      return 'x-circle';
    });

    // ── AI 纠错状态：对照模型判断 + Agent 视觉复核给出四态展示 ──
    const reviewInfo = computed(() => {
      const msg = messages.value.find(m => m.role === 'assistant' && m.review);
      if (!msg) return null;
      const review = msg.review;
      const conf = diagnosis.value?.top1?.confidence ?? 0;
      const modelLabel = diagnosis.value?.top1?.label_cn || '';

      if (review.agrees_with_model === null || review.agrees_with_model === undefined) {
        return {
          level: 'gray',
          text: '图片质量不足以判断，建议重新拍摄清晰照片',
          detail: review.confidence_note || '',
          evidence: [],
        };
      }
      if (review.agrees_with_model === false) {
        return {
          level: 'orange',
          text: `AI 判断可能是"${review.ai_diagnosis || '未知'}"，与模型结果不同`,
          detail: `模型：${modelLabel}　AI：${review.ai_diagnosis || '未知'}（建议以 AI 判断为准）`,
          evidence: review.visual_evidence || [],
        };
      }
      if (conf < 80) {
        return {
          level: 'yellow',
          text: '模型与 AI 判断一致，但置信度较低，建议人工复核',
          detail: '',
          evidence: review.visual_evidence || [],
        };
      }
      return {
        level: 'green',
        text: '模型 + AI 双重确认一致',
        detail: '',
        evidence: review.visual_evidence || [],
      };
    });

    function togglePanel() { panelExpanded.value = !panelExpanded.value; }

    function getMsgContent(msg, idx) {
      if (msg.role === 'assistant' && idx === typingMsgIdx.value) {
        return typingText.value || '';
      }
      return msg.content || '';
    }

    function scrollToBottom() {
      nextTick(() => {
        const el = chatBody.value;
        if (el) el.scrollTop = el.scrollHeight;
      });
    }
    watch(typingText, scrollToBottom);
    watch(() => messages.value.length, scrollToBottom);

    async function startAiAnalysis() {
      try {
        const data = await startChat(diagnosisStore.state.result);
        chatStore.state.sessionId = data.session_id;
        openStream('');
      } catch (e) {
        ui.showToast(e.message || 'AI 分析请求失败', 'error');
      }
    }

    function onAttachClick() {
      if (loading.value) return;
      fileInput.value?.click();
    }
    function onImageSelected(e) {
      const file = e.target.files[0];
      e.target.value = '';
      if (!file) return;
      pendingImage.value = file;
      pendingImageUrl.value = URL.createObjectURL(file);
    }
    function clearPendingImage() {
      pendingImage.value = null;
      pendingImageUrl.value = null;
    }

    function sendMessage() {
      const text = inputText.value.trim();
      const file = pendingImage.value;
      if ((!text && !file) || loading.value) return;

      // 未经过诊断页直接进入对话时，本地生成一个会话 id，保证多轮追问落在同一会话
      if (!chatStore.state.sessionId) {
        chatStore.state.sessionId = 'anon-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
      }

      chatStore.state.messages.push({
        role: 'user',
        content: text,
        imageUrl: pendingImageUrl.value,
        time: new Date().toLocaleTimeString(),
      });
      inputText.value = '';
      pendingImage.value = null;
      pendingImageUrl.value = null;

      if (file) {
        sendImageMessage(file);
      } else {
        openStream(text);
      }
    }

    // ── 图片消息：先调用分类模型识别，再让 Agent 基于识别结果流式生成建议 ──
    async function sendImageMessage(file) {
      loading.value = true;
      try {
        const predictData = await predict(file);
        diagnosisStore.setResult(predictData);
        const startData = await startChat(predictData);
        chatStore.state.sessionId = startData.session_id;
        openStream('');
      } catch (e) {
        loading.value = false;
        ui.showToast(e.message || '图片识别失败', 'error');
      }
    }

    function goDiagnose() { navigate('diagnose'); }

    onMounted(() => {
      if (hasDiagnosis.value && chatStore.state.messages.length === 0) {
        nextTick(() => startAiAnalysis());
      }
    });
    onBeforeUnmount(() => {
      closeStream();
    });

    return {
      inputText, loading, panelExpanded, pendingImage, pendingImageUrl,
      chatBody, fileInput, typingMsgIdx,
      diagnosis, messages, hasDiagnosis, quickQuestions, confClass, confLabel, confIcon, reviewInfo,
      togglePanel, getMsgContent, onAttachClick, onImageSelected, clearPendingImage,
      sendMessage, goDiagnose,
    };
  },
  template: `
    <div>
      <div class="chat-layout">
        <!-- ═══ 左侧：对话区 ═══ -->
        <div class="chat-main">
          <div class="chat-messages" ref="chatBody">
            <!-- 欢迎引导态 -->
            <div v-if="messages.length === 0 && !hasDiagnosis" class="chat-welcome" style="animation: fadeScaleIn 0.4s ease;">
              <div class="welcome-icon"><app-icon name="bot" :size="40"></app-icon></div>
              <div class="welcome-text">你好！我是农业病虫害智能助手</div>
              <div class="welcome-sub">你可以：</div>
              <div class="welcome-hints">
                · 从诊断页跳转过来，让我帮你分析叶片图片<br>
                · 直接问我病害防治问题<br>
                · 上传图片让我看看
              </div>
              <button class="btn btn-primary" style="margin:20px auto 0;max-width:280px;" @click="onAttachClick">
                <app-icon name="camera" :size="15"></app-icon> 直接在这里上传图片
              </button>
              <button class="btn btn-outline" style="margin:10px auto 0;max-width:280px;" @click="goDiagnose">
                <app-icon name="search" :size="15"></app-icon> 去诊断页查看完整流程
              </button>
              <div class="welcome-divider"></div>
              <div class="welcome-suggest-label" style="display:flex;align-items:center;justify-content:center;gap:6px;"><app-icon name="lightbulb" :size="14"></app-icon> 试试问我：</div>
              <div>
                <span class="welcome-suggest-item">· 番茄叶子发黄是什么病？</span>
                <span class="welcome-suggest-item">· 水稻常见的病害有哪些？</span>
                <span class="welcome-suggest-item">· 如何预防玉米锈病？</span>
              </div>
            </div>

            <!-- 对话消息 — staggered 入场 -->
            <div
              v-for="(msg, idx) in messages"
              :key="idx"
              class="chat-bubble"
              :class="msg.role"
              :style="{ animationDelay: (0.05 * idx) + 's' }"
            >
              <div class="chat-avatar"><app-icon :name="msg.role === 'assistant' ? 'bot' : 'user'" :size="16"></app-icon></div>
              <div>
                <div class="chat-bubble-inner">
                  <img
                    v-if="msg.imageUrl"
                    :src="msg.imageUrl"
                    style="max-width:200px;max-height:200px;border-radius:12px;display:block;margin-bottom:8px;object-fit:cover;"
                  />
                  <div v-if="getMsgContent(msg, idx)" style="white-space:pre-wrap;">{{ getMsgContent(msg, idx) }}</div>
                  <!-- 打字光标 -->
                  <span v-if="idx === typingMsgIdx" class="typing-cursor"></span>
                  <advice-card v-if="msg.advice" :advice="msg.advice"></advice-card>
                </div>
                <div style="font-size:11px;color:#bbb;margin-top:4px;" v-if="msg.time">{{ msg.time }}</div>
              </div>
            </div>

            <!-- 打字指示器 -->
            <div v-if="loading" class="chat-bubble ai">
              <div class="chat-avatar"><app-icon name="bot" :size="16"></app-icon></div>
              <div class="typing-indicator">
                <span></span><span></span><span></span>
              </div>
            </div>
          </div>

          <!-- ═══ 待发送图片预览 ═══ -->
          <div v-if="pendingImageUrl" style="display:flex;align-items:center;gap:10px;padding:8px 0;">
            <div style="position:relative;">
              <img :src="pendingImageUrl" style="width:56px;height:56px;border-radius:10px;object-fit:cover;display:block;" />
              <button
                @click="clearPendingImage"
                style="position:absolute;top:-6px;right:-6px;width:20px;height:20px;border-radius:50%;background:#546E7A;color:#fff;border:none;cursor:pointer;display:flex;align-items:center;justify-content:center;"
              ><app-icon name="x" :size="11"></app-icon></button>
            </div>
            <span style="font-size:13px;color:var(--color-text-hint);">将自动识别病害并生成防治建议</span>
          </div>

          <!-- ═══ 输入区 ═══ -->
          <div class="chat-input-bar">
            <input type="file" accept="image/*" ref="fileInput" style="display:none;" @change="onImageSelected" />
            <button
              class="btn btn-outline"
              style="min-width:44px;padding:0;flex-shrink:0;"
              :disabled="loading"
              title="上传叶片图片，自动识别病害"
              @click="onAttachClick"
            ><app-icon name="camera" :size="16"></app-icon></button>
            <input
              v-model="inputText"
              placeholder="输入你的问题，如：用什么药效果好？"
              :disabled="loading"
              @keyup.enter="sendMessage"
            />
            <button
              class="btn btn-primary"
              :class="{ 'is-loading': loading }"
              style="min-width:64px;"
              :disabled="(!inputText.trim() && !pendingImage) || loading"
              @click="sendMessage"
            >
              <app-icon v-if="!loading" name="send" :size="16"></app-icon>
            </button>
          </div>
        </div>

        <!-- ═══ 右侧：信息面板（移动端手风琴） ═══ -->
        <div class="chat-panel" v-if="hasDiagnosis">
          <!-- 诊断信息 — 可折叠 -->
          <div class="panel-card" :class="{ expanded: panelExpanded }">
            <div
              class="panel-card-title"
              style="cursor:pointer;display:flex;justify-content:space-between;align-items:center;"
              @click="togglePanel"
            >
              <span style="display:flex;align-items:center;gap:6px;"><app-icon name="clipboard" :size="14"></app-icon> 当前诊断信息</span>
              <app-icon name="chevron-down" :size="13" style="transition:transform 0.3s ease;" :style="{ transform: panelExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }"></app-icon>
            </div>
            <div v-show="true">
              <div style="font-weight:600;font-size:15px;margin-bottom:4px;">
                {{ diagnosis?.top1?.crop }} · {{ diagnosis?.top1?.label_cn }}
              </div>
              <div style="font-size:13px;color:#999;">置信度 {{ diagnosis?.top1?.confidence }}%</div>
              <span class="conf-tag" :class="confClass" style="margin-top:6px;display:inline-flex;align-items:center;gap:4px;">
                <app-icon :name="confIcon" :size="12"></app-icon>{{ confLabel }}
              </span>
            </div>
          </div>

          <!-- 纠错状态：模型 + Agent 视觉复核双重判断 -->
          <div class="panel-card">
            <div class="panel-card-title"><app-icon name="search" :size="14"></app-icon> AI 纠错状态</div>
            <div v-if="reviewInfo">
              <div
                style="font-size:14px;font-weight:600;display:flex;align-items:center;gap:6px;"
                :style="{ color: { green:'var(--color-success)', yellow:'var(--color-warning)', orange:'var(--color-accent)', gray:'#999' }[reviewInfo.level] }"
              >
                <span
                  style="width:8px;height:8px;border-radius:50%;flex-shrink:0;display:inline-block;"
                  :style="{ background: { green:'var(--color-success)', yellow:'var(--color-warning)', orange:'var(--color-accent)', gray:'#999' }[reviewInfo.level] }"
                ></span>
                {{ reviewInfo.text }}
              </div>
              <div v-if="reviewInfo.detail" style="font-size:12px;color:#999;margin-top:4px;">{{ reviewInfo.detail }}</div>
              <div v-if="reviewInfo.evidence.length" style="font-size:12px;color:#888;margin-top:6px;line-height:1.7;">
                <div v-for="(e, i) in reviewInfo.evidence" :key="i">· {{ e }}</div>
              </div>
            </div>
            <div v-else style="font-size:13px;color:#999;">
              等待 AI 分析...
            </div>
          </div>

          <!-- 推荐追问 — hover 颜色变化 -->
          <div class="panel-card">
            <div class="panel-card-title"><app-icon name="lightbulb" :size="14"></app-icon> 推荐追问</div>
            <button
              v-for="(q, i) in quickQuestions"
              :key="i"
              class="quick-question"
              @click="inputText = q; sendMessage();"
            >{{ q }}</button>
            <div v-if="!quickQuestions.length" style="font-size:13px;color:#999;">
              从诊断页跳转后自动生成追问
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
};
