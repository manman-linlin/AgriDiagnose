/**
 * AgriDiagnose — 路由模块
 * 管理侧边栏导航和页面切换，直接对应小程序的页面栈概念。
 * 挂载：window.AppRouter
 */
window.AppRouter = {
  /** 当前激活的页面标识 */
  current: 'diagnose',

  /** 页面注册表：key → { title, icon } */
  pages: {
    diagnose:     { title: '智能诊断',   icon: '🔍' },
    chat:         { title: 'AI 对话',     icon: '🤖' },
    contribute:   { title: '数据贡献',   icon: '📤' },
    encyclopedia: { title: '病害百科',   icon: '📖' },
    history:      { title: '历史·统计',   icon: '📋' },
  },

  /**
   * 切换到指定页面
   * @param {string} page - 页面标识（需在 pages 中注册）
   */
  navigate(page) {
    if (this.pages[page] && this.current !== page) {
      this.current = page;
    }
  },

  /** 获取当前页面标题 */
  getCurrentTitle() {
    return this.pages[this.current]?.title || '';
  },
};
