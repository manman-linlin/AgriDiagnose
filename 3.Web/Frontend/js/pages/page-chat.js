/**
 * AI 智能诊断对话页面 — 优化版：消息 staggered 入场、逐字输出、按钮状态、手风琴面板
 */
window.makePageChat = function () {
  const store  = window.AppStore;
  const router = window.AppRouter;

  return {
    data() {
      return {
        inputText: '',
        loading: false,
        panelExpanded: false,
        typingText: '',          // 逐字输出当前文本
        typingTimer: null,       // 打字定时器
        typingMsgIdx: -1,        // 正在打字的 msg index
      };
    },
    computed: {
      diagnosis()   { return store.diagnosis.result; },
      messages()    { return store.chat.messages; },
      hasDiagnosis() { return store.diagnosis.status === 'done' && !!store.diagnosis.result; },
      quickQuestions() {
        if (!this.hasDiagnosis) return [];
        const d = store.diagnosis.result.top1;
        return [
          `"${d.label_cn}"用什么药效果最好？`,
          `"${d.label_cn}"一般多久能治好？`,
          `如何预防"${d.label_cn}"复发？`,
          `这个季节容易得"${d.label_cn}"吗？`,
        ];
      },
      confClass() {
        const v = this.diagnosis?.top1?.confidence || 0;
        if (v >= 90) return 'high';
        if (v >= 60) return 'mid';
        return 'low';
      },
      confLabel() {
        const v = this.diagnosis?.top1?.confidence || 0;
        if (v >= 90) return '✅ 高置信度';
        if (v >= 60) return '⚠️ 中置信度';
        return '❌ 低置信度';
      },
    },
    mounted() {
      if (this.hasDiagnosis && store.chat.messages.length === 0) {
        this.$nextTick(() => this.startAiAnalysis());
      }
    },
    beforeUnmount() {
      this.stopTyping();
    },
    methods: {
      togglePanel() { this.panelExpanded = !this.panelExpanded; },

      // ── 打字效果：逐字输出 ──
      startTyping(text, msgIdx) {
        this.stopTyping();
        this.typingText = '';
        this.typingMsgIdx = msgIdx;
        let i = 0;
        const speed = 30 + Math.random() * 25; // 30-55ms per char
        this.typingTimer = setInterval(() => {
          if (i < text.length) {
            this.typingText += text[i];
            i++;
            // 确保滚动跟随
            this.scrollToBottom();
          } else {
            this.stopTyping();
            // Typing complete — store final text
            if (this.typingMsgIdx >= 0 && this.typingMsgIdx < store.chat.messages.length) {
              store.chat.messages[this.typingMsgIdx]._typedContent = text;
            }
          }
        }, speed);
      },
      stopTyping() {
        if (this.typingTimer) {
          clearInterval(this.typingTimer);
          this.typingTimer = null;
        }
        this.typingMsgIdx = -1;
      },
      getMsgContent(msg, idx) {
        // 如果是正在打字的 AI 消息，返回打字文本
        if (msg.role === 'assistant' && idx === this.typingMsgIdx) {
          return this.typingText || '';
        }
        // 如果已经打完
        if (msg._typedContent) return msg._typedContent;
        return msg.content || '';
      },

      // ── 开始 AI 分析 ──
      async startAiAnalysis() {
        this.loading = true;
        const d = store.diagnosis.result.top1;

        const fullContent = `我收到了你的叶片图片和模型识别结果。\n\n经过多模态分析，我判断：这确实是**${d.label_cn}**。模型识别结果与我的视觉分析一致。\n\n以下是详细的防治方案：`;

        const aiMsg = {
          role: 'assistant',
          content: fullContent,
          advice: {
            disease_name: d.label_cn,
            symptoms: '叶片出现不规则病斑，颜色异常，严重时叶片枯黄脱落。',
            cause: '病原菌侵染引起，高温高湿环境下易发生。',
            prevention: [
              '选择抗病品种进行种植',
              '合理轮作，避免连作',
              '加强田间通风透光',
              '及时清理病残体',
            ],
            treatment: [
              '发病初期使用针对性杀菌剂喷雾',
              '注意药剂交替使用，避免产生抗药性',
              '严格遵守农药安全间隔期',
            ],
            risk_level: '中',
            manual_check_required: false,
          },
          time: new Date().toLocaleTimeString(),
        };

        // 模拟延迟后推送消息
        await new Promise(r => setTimeout(r, 1500));
        store.chat.messages.push(aiMsg);
        const msgIdx = store.chat.messages.length - 1;
        this.loading = false;

        // 启动打字效果
        this.$nextTick(() => {
          this.startTyping(fullContent, msgIdx);
        });
      },

      // ── 发送消息 ──
      async sendMessage() {
        const text = this.inputText.trim();
        if (!text || this.loading) return;

        store.chat.messages.push({
          role: 'user',
          content: text,
          time: new Date().toLocaleTimeString(),
        });
        this.inputText = '';
        this.loading = true;
        this.scrollToBottom();

        // 模拟 AI 回复
        await new Promise(r => setTimeout(r, 2000));
        const replyContent = `关于"${text}"，作为农业病虫害防治专家，建议您注意以下几点：\n\n1. 及时观察作物生长状况，发现异常尽早处理\n2. 遵循"预防为主，综合防治"的原则\n3. 在专业农技人员指导下合理用药\n\n如需更详细的方案，请上传叶片图片进行诊断分析。`;

        store.chat.messages.push({
          role: 'assistant',
          content: replyContent,
          time: new Date().toLocaleTimeString(),
        });
        const msgIdx = store.chat.messages.length - 1;
        this.loading = false;

        // 启动打字效果
        this.$nextTick(() => {
          this.startTyping(replyContent, msgIdx);
        });
      },

      scrollToBottom() {
        this.$nextTick(() => {
          const el = this.$refs.chatBody;
          if (el) el.scrollTop = el.scrollHeight;
        });
      },

      goDiagnose() { router.navigate('diagnose'); },
    },
    template: `
      <div>
        <div class="chat-layout">
          <!-- ═══ 左侧：对话区 ═══ -->
          <div class="chat-main">
            <div class="chat-messages" ref="chatBody">
              <!-- 欢迎引导态 -->
              <div v-if="messages.length === 0 && !hasDiagnosis" class="chat-welcome" style="animation: fadeScaleIn 0.4s ease;">
                <div class="welcome-icon">🤖</div>
                <div class="welcome-text">你好！我是农业病虫害智能助手</div>
                <div class="welcome-sub">你可以：</div>
                <div class="welcome-hints">
                  · 从诊断页跳转过来，让我帮你分析叶片图片<br>
                  · 直接问我病害防治问题<br>
                  · 上传图片让我看看
                </div>
                <button class="btn btn-primary" style="margin:20px auto 0;max-width:280px;" @click="goDiagnose">
                  🔍 先去诊断一张图片
                </button>
                <div class="welcome-divider"></div>
                <div class="welcome-suggest-label">💡 试试问我：</div>
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
                :style="{ animation: 'chatBubbleIn 0.4s cubic-bezier(0.4, 0, 0.2, 1) backwards', animationDelay: (0.08 * idx) + 's' }"
              >
                <div class="chat-avatar">{{ msg.role === 'assistant' ? '🤖' : '👤' }}</div>
                <div>
                  <div class="chat-bubble-inner">
                    <div style="white-space:pre-wrap;">{{ getMsgContent(msg, idx) }}</div>
                    <!-- 打字光标 -->
                    <span
                      v-if="idx === typingMsgIdx"
                      class="typing-cursor"
                      style="display:inline-block;width:2px;height:16px;background:var(--color-primary);animation:blink 0.8s step-end infinite;vertical-align:text-bottom;margin-left:1px;"
                    ></span>
                    <app-advice-card v-if="msg.advice" :advice="msg.advice"></app-advice-card>
                  </div>
                  <div style="font-size:11px;color:#bbb;margin-top:4px;" v-if="msg.time">{{ msg.time }}</div>
                </div>
              </div>

              <!-- 打字指示器 -->
              <div v-if="loading" class="chat-bubble ai">
                <div class="chat-avatar">🤖</div>
                <div class="typing-indicator">
                  <span></span><span></span><span></span>
                </div>
              </div>
            </div>

            <!-- ═══ 输入区 ═══ -->
            <div class="chat-input-bar">
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
                :disabled="!inputText.trim() || loading"
                @click="sendMessage"
              >
                {{ loading ? '' : '→' }}
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
                <span>📋 当前诊断信息</span>
                <span style="font-size:12px;transition:transform 0.3s ease;" :style="{ transform: panelExpanded ? 'rotate(180deg)' : 'rotate(0deg)' }">▼</span>
              </div>
              <div v-show="true">
                <div style="font-weight:600;font-size:15px;margin-bottom:4px;">
                  {{ diagnosis?.top1?.crop }} · {{ diagnosis?.top1?.label_cn }}
                </div>
                <div style="font-size:13px;color:#999;">置信度 {{ diagnosis?.top1?.confidence }}%</div>
                <span class="conf-tag" :class="confClass" style="margin-top:6px;">{{ confLabel }}</span>
              </div>
            </div>

            <!-- 纠错状态 -->
            <div class="panel-card">
              <div class="panel-card-title">🔍 AI 纠错状态</div>
              <div v-if="messages.length" style="font-size:14px;color:var(--color-success);">
                ✅ 模型 + AI 双重确认
              </div>
              <div v-else style="font-size:13px;color:#999;">
                等待 AI 分析...
              </div>
            </div>

            <!-- 推荐追问 — hover 颜色变化 -->
            <div class="panel-card">
              <div class="panel-card-title">💡 推荐追问</div>
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
};
