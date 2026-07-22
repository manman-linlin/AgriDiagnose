/**
 * 统一线性图标组件 —— 替换全站 emoji-as-icon 用法。
 * 手写的 Feather 风格 SVG 路径字典（24x24 视口、currentColor 描边），
 * 不引入新的 CDN 依赖。用法：<app-icon name="search" :size="18" />
 */
const ICONS = {
  // 导航 / 品牌
  search:        '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>',
  bot:           '<rect x="3" y="8" width="18" height="12" rx="2"/><circle cx="8.5" cy="14" r="1.4"/><circle cx="15.5" cy="14" r="1.4"/><path d="M12 8V4"/><circle cx="12" cy="3" r="1" fill="currentColor" stroke="none"/>',
  upload:        '<path d="M12 3v12"/><path d="M7 8l5-5 5 5"/><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2"/>',
  'book-open':   '<path d="M2 4.5h7a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2z"/><path d="M22 4.5h-7a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h8z"/>',
  clipboard:     '<rect x="5" y="4" width="14" height="17" rx="2"/><path d="M9 4V3a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1"/><line x1="8" y1="10" x2="16" y2="10"/><line x1="8" y1="14" x2="16" y2="14"/><line x1="8" y1="18" x2="13" y2="18"/>',
  leaf:          '<path d="M4 13c0-5.5 4.5-9.5 16-9.5-1 10.5-6 14.5-11 14.5-1.8 0-2.9-.4-3.8-1"/><path d="M5.2 18.8c2.6-2.6 3.8-5.6 3.8-9.3"/>',

  // 状态 / 反馈
  'check-circle':  '<circle cx="12" cy="12" r="9"/><path d="M8.3 12.5l2.3 2.3 5-5.2"/>',
  'x-circle':      '<circle cx="12" cy="12" r="9"/><line x1="9" y1="9" x2="15" y2="15"/><line x1="15" y1="9" x2="9" y2="15"/>',
  'alert-triangle':'<path d="M12 3.2l9.3 16.6H2.7z"/><line x1="12" y1="9.5" x2="12" y2="14"/><circle cx="12" cy="16.8" r="0.6" fill="currentColor" stroke="none"/>',
  clock:           '<circle cx="12" cy="12" r="9"/><path d="M12 7.5v4.8l3.2 1.9"/>',
  check:           '<path d="M5 12.5l4.5 4.5L19 7"/>',

  // 交互 chrome
  x:            '<line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/>',
  trash:        '<path d="M4 7h16"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13"/><path d="M9 7V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v3"/>',
  menu:         '<line x1="4" y1="7" x2="20" y2="7"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="17" x2="20" y2="17"/>',
  'refresh-cw': '<path d="M20.5 12a8.5 8.5 0 0 1-14.6 6"/><path d="M3.5 12a8.5 8.5 0 0 1 14.6-6"/><path d="M3.5 15.2V11h4.2"/><path d="M20.5 8.8V13h-4.2"/>',
  user:         '<circle cx="12" cy="8" r="4"/><path d="M4.2 21c0-4.1 3.5-7 7.8-7s7.8 2.9 7.8 7"/>',
  lock:         '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  key:          '<circle cx="8" cy="15" r="4"/><path d="M11 12l8-8"/><path d="M16 5l3 3"/><path d="M13.3 7.7l2 2"/>',
  'chevron-down':'<path d="M6 9l6 6 6-6"/>',
  send:         '<path d="M4 12l16-8-6.2 16-3-6.4z"/><path d="M13.8 13.6L20 4"/>',

  // 领域内容
  camera:        '<path d="M4 8h3.2l1.8-3h6l1.8 3H20a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.2" r="3.4"/>',
  inbox:         '<path d="M4 4.5h16l-1.6 9.5h-3.7a2.7 2.7 0 0 1-5.4 0H5.6z"/><path d="M4 4.5l1.6 9.5V19a1 1 0 0 0 1 1h10.8a1 1 0 0 0 1-1v-5L20 4.5"/>',
  'bar-chart':   '<line x1="6" y1="20" x2="6" y2="12"/><line x1="12" y1="20" x2="12" y2="8"/><line x1="18" y1="20" x2="18" y2="4"/>',
  sparkle:       '<path d="M12 3l1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6z" fill="currentColor" stroke="none"/>',
  stethoscope:   '<path d="M6.5 3v6.2a3.7 3.7 0 0 0 7.4 0V3"/><path d="M10.2 13v1.6a5 5 0 0 0 10 0v-2"/><circle cx="20.2" cy="10.6" r="1.4"/>',
  thermometer:   '<path d="M12 3.2a2 2 0 0 0-2 2v9.6a4 4 0 1 0 4 0V5.2a2 2 0 0 0-2-2z"/><line x1="12" y1="8" x2="12" y2="14"/>',
  shield:        '<path d="M12 3.2l7 2.8v5.8c0 5-3.5 8-7 9-3.5-1-7-4-7-9V6z"/>',
  pill:          '<rect x="2.8" y="9.3" width="18.4" height="6.4" rx="3.2" transform="rotate(-45 12 12)"/><line x1="9.3" y1="14.7" x2="14.7" y2="9.3"/>',
  bug:           '<rect x="8" y="8.5" width="8" height="10" rx="4"/><line x1="12" y1="4.5" x2="12" y2="8.5"/><line x1="3.6" y1="10.5" x2="8" y2="10.5"/><line x1="3.6" y1="15.5" x2="8" y2="15.5"/><line x1="16" y1="10.5" x2="20.4" y2="10.5"/><line x1="16" y1="15.5" x2="20.4" y2="15.5"/><path d="M9 4.5l1.4 2.2"/><path d="M15 4.5l-1.4 2.2"/>',
  lightbulb:     '<path d="M9.2 18.5h5.6"/><path d="M10.2 21.2h3.6"/><path d="M12 3.2a6 6 0 0 0-3.4 10.9c.4.3.6.7.6 1.2v.4h5.6v-.4c0-.5.2-.9.6-1.2A6 6 0 0 0 12 3.2z"/>',
  message:       '<path d="M4 4.5h16v12H8.5L4 20.5z"/>',
  paperclip:     '<path d="M8 13.2l6.2-6.2a3 3 0 0 1 4.2 4.2l-8 8a5 5 0 0 1-7-7l7-7"/>',
  cpu:           '<rect x="4" y="4" width="16" height="16" rx="2"/><rect x="9" y="9" width="6" height="6"/><line x1="9" y1="1" x2="9" y2="4"/><line x1="15" y1="1" x2="15" y2="4"/><line x1="9" y1="20" x2="9" y2="23"/><line x1="15" y1="20" x2="15" y2="23"/><line x1="20" y1="9" x2="23" y2="9"/><line x1="20" y1="14" x2="23" y2="14"/><line x1="1" y1="9" x2="4" y2="9"/><line x1="1" y1="14" x2="4" y2="14"/>',
  settings:      '<circle cx="12" cy="12" r="3"/><path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>',
  edit:          '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>',
  play:          '<polygon points="6 3 20 12 6 21 6 3"/>',
  plus:          '<line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>',
  users:         '<circle cx="8" cy="8" r="3.5"/><path d="M2 21c0-4 2.7-6.5 6-6.5"/><circle cx="18" cy="10" r="2.5"/><path d="M14 21c0-3 2-5 4-5"/>',
  mail:          '<rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 7l10 7 10-7"/>',
  image:         '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/>',
  'book-open':   '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  'log-out':     '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
  'user-plus':   '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>',
  server:        '<rect x="2" y="2" width="20" height="8" rx="2"/><rect x="2" y="14" width="20" height="8" rx="2"/><circle cx="6" cy="6" r="1" fill="currentColor" stroke="none"/><circle cx="6" cy="18" r="1" fill="currentColor" stroke="none"/>',
  'file-text':   '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/>',
  train:         '<rect x="3" y="3" width="18" height="18" rx="3"/><line x1="8" y1="8" x2="16" y2="16"/><line x1="16" y1="8" x2="8" y2="16"/>',
  'refresh-cw':  '<polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>',
  eye:           '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>',
  'eye-off':     '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>',
  'file-text':   '<path d="M7 3h7l4 4v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="15" y2="16"/>',

  // 新增：管理后台专用
  calendar:      '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
  'trending-up':  '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  bell:           '<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/>',
  terminal:       '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
};

export default {
  name: 'AppIcon',
  props: {
    name:        { type: String, required: true },
    size:        { type: [Number, String], default: 18 },
    strokeWidth: { type: [Number, String], default: 1.8 },
  },
  template: `
    <svg
      :width="size"
      :height="size"
      viewBox="0 0 24 24"
      fill="none"
      :stroke-width="strokeWidth"
      stroke="currentColor"
      stroke-linecap="round"
      stroke-linejoin="round"
      class="app-icon"
      aria-hidden="true"
      v-html="svgInner"
    ></svg>
  `,
  computed: {
    svgInner() {
      return ICONS[this.name] || '';
    },
  },
};
