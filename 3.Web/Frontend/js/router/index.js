/**
 * AgriDiagnose — 路由模块（hash 同步版）
 * 与旧版 router.js 的区别：当前页会同步写入 location.hash，
 * 支持刷新保留当前页、浏览器前进/后退、以及分享指向具体页面的链接。
 */
import { reactive, computed } from 'vue';

/** 页面注册表：key → { title, icon, type } */
export const PAGES = {
  diagnose:     { title: '智能诊断',   icon: 'search',    type: 'public' },
  chat:         { title: 'AI 对话',     icon: 'bot',       type: 'public' },
  contribute:   { title: '数据贡献',   icon: 'upload',    type: 'public' },
  encyclopedia: { title: '病害百科',   icon: 'book-open', type: 'public' },
  history:      { title: '历史·统计',   icon: 'clipboard', type: 'public' },
};

/** 管理后台子页面注册表 */
export const ADMIN_PAGES = {
  dashboard:    { title: '数据概览',  icon: 'bar-chart' },
  review:       { title: '审核管理',  icon: 'check-circle' },
  model:        { title: '模型管理',  icon: 'cpu' },
  settings:     { title: '系统配置',  icon: 'settings' },
  encyclopedia: { title: '百科管理',  icon: 'book-open' },
  users:        { title: '用户管理',  icon: 'users' },
  logs:         { title: '系统日志',  icon: 'terminal' },
};

const DEFAULT_PAGE = 'diagnose';

/** 兼容旧版：纯 key 匹配 */
function parseHash() {
  const key = (location.hash || '').replace(/^#\/?/, '');
  return PAGES[key] ? key : DEFAULT_PAGE;
}

/**
 * 新版路由解析：返回 { type, sub }
 * type: 'public' | 'admin' | 'fullscreen'
 * admin 页面 URL 格式: #/admin/{sub}
 * fullscreen 页面 URL 格式: #/login | #/register
 */
export function resolveRoute() {
  const hash = (location.hash || '').replace(/^#\/?/, '');
  if (hash.startsWith('admin/')) {
    const sub = hash.slice(6) || 'dashboard';
    return { type: 'admin', sub: ADMIN_PAGES[sub] ? sub : 'dashboard' };
  }
  return { type: 'public', sub: PAGES[hash] ? hash : DEFAULT_PAGE };
}

const state = reactive({
  current: parseHash(),
  /** 每次 hash 变化 +1，强制所有依赖 computed 重新求值 */
  tick: 0,
});

/** 导出路由原始状态，供外部 computed 建立明确的响应式依赖 */
export { state as routerState };

/** 当前激活的页面标识（响应式，只读） */
export const currentPage = computed(() => {
  void state.tick; // 消费 tick 以建立响应式依赖
  return state.current;
});

/** 当前页面标题 */
export const currentTitle = computed(() => {
  const route = resolveRoute();
  if (route.type === 'admin') return '管理后台 — ' + (ADMIN_PAGES[route.sub]?.title || '');
  return PAGES[state.current]?.title || '';
});

/** 当前路由类型 */
export const currentRouteType = computed(() => resolveRoute().type);

/**
 * 切换到指定页面，并同步更新 URL hash
 * @param {string} page - 页面标识（需在 PAGES 中注册）
 */
export function navigate(page) {
  if (!PAGES[page]) return;
  if (state.current !== page) {
    state.current = page;
  }
  const target = '#/' + page;
  if (location.hash !== target) {
    location.hash = target;
  }
}

/** 跳转到管理后台子页面 */
export function navigateToAdmin(sub) {
  const target = '#/admin/' + (ADMIN_PAGES[sub] ? sub : 'dashboard');
  if (location.hash !== target) location.hash = target;
}

let initialized = false;

/**
 * Transition key：页面切换动画使用
 * 格式 "type-sub"，确保不同路由类型/页面有不同的 key。
 * 依赖 state.tick 建立响应式：每次 hash 变化都重新求值。
 */
export const transitionKey = computed(() => {
  void state.tick;               // ← 响应式依赖：hashchange 时 tick 自增，触发重新求值
  const route = resolveRoute();
  return route.type + '-' + route.sub;
});

/** 启动路由：监听 hashchange，并规范化初始 URL */
export function initRouter() {
  if (initialized) return;
  initialized = true;

  window.addEventListener('hashchange', () => {
    const route = resolveRoute();
    state.tick++;  // 每次 hash 变化都触发响应式更新
    if (route.type === 'public' && route.sub !== state.current) {
      state.current = route.sub;
    }
  });

  const route = resolveRoute();
  if (route.type === 'public') {
    const target = '#/' + state.current;
    if (location.hash !== target) {
      history.replaceState(null, '', target);
    }
  }
  // admin/fullscreen 初始 hash 保持不变，不做 rewrite
}
