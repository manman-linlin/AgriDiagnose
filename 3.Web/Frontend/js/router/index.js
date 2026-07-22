/**
 * AgriDiagnose — 路由模块（hash 同步版）
 * 与旧版 router.js 的区别：当前页会同步写入 location.hash，
 * 支持刷新保留当前页、浏览器前进/后退、以及分享指向具体页面的链接。
 */
import { reactive, computed } from 'vue';

/** 页面注册表：key → { title, icon } */
export const PAGES = {
  diagnose:     { title: '智能诊断',   icon: 'search' },
  chat:         { title: 'AI 对话',     icon: 'bot' },
  contribute:   { title: '数据贡献',   icon: 'upload' },
  encyclopedia: { title: '病害百科',   icon: 'book-open' },
  history:      { title: '历史·统计',   icon: 'clipboard' },
};

const DEFAULT_PAGE = 'diagnose';

function parseHash() {
  const key = (location.hash || '').replace(/^#\/?/, '');
  return PAGES[key] ? key : DEFAULT_PAGE;
}

const state = reactive({
  current: parseHash(),
});

/** 当前激活的页面标识（响应式，只读） */
export const currentPage = computed(() => state.current);

/** 当前页面标题 */
export const currentTitle = computed(() => PAGES[state.current]?.title || '');

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

let initialized = false;

/** 启动路由：监听 hashchange，并规范化初始 URL。只需在应用挂载时调用一次。 */
export function initRouter() {
  if (initialized) return;
  initialized = true;

  window.addEventListener('hashchange', () => {
    const page = parseHash();
    if (page !== state.current) state.current = page;
  });

  const target = '#/' + state.current;
  if (location.hash !== target) {
    history.replaceState(null, '', target);
  }
}
