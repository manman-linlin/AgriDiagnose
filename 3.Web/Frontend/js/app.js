/**
 * AgriDiagnose — Vue 应用入口
 * 初始化应用、注册所有组件、挂载到 #app
 */

(function () {
  // 保存原始 navigate 引用
  var _origNavigate = window.AppRouter.navigate.bind(window.AppRouter);

  var app = Vue.createApp({
    data: function () {
      return {
        page: window.AppRouter.current,
        pages: window.AppRouter.pages,
        sidebarOpen: false,              // 手机端侧边栏开关
      };
    },

    computed: {
      currentTitle: function () {
        return window.AppRouter.getCurrentTitle();
      },
      // 关键修复：用 computed 桥接 reactive 对象，避免 data() 中 Proxy 嵌套
      toast: function () {
        return window.AppStore.toast;
      },
      system: function () {
        return window.AppStore.system;
      },
    },

    methods: {
      navigate: function (targetPage) {
        if (window.AppRouter.pages[targetPage] && this.page !== targetPage) {
          this.page = targetPage;
          window.AppRouter.current = targetPage;
        }
      },
      toggleSidebar: function () { this.sidebarOpen = !this.sidebarOpen; },
      closeSidebar: function ()  { this.sidebarOpen = false; },
    },

    mounted: function () {
      var vue = this;
      // 替换全局 navigate 使其同步更新 Vue 的 page
      window.AppRouter.navigate = function (targetPage) {
        _origNavigate(targetPage);
        vue.page = window.AppRouter.current;
      };
      // 启动时检查模型状态
      window.AppStore.checkHealth();
    },
  });

  // ── 注册 UI 组件 ──
  var components = [
    ['app-sidebar',        window.makeAppSidebar],
    ['app-loading',        window.makeAppLoading],
    ['app-empty',          window.makeAppEmpty],
    ['app-error',          window.makeAppError],
    ['app-conf-bar',       window.makeAppConfBar],
    ['app-top3-list',      window.makeAppTop3List],
    ['app-advice-card',    window.makeAppAdviceCard],
    ['app-result-card',    window.makeAppResultCard],
    ['app-image-uploader', window.makeAppImageUploader],
    ['app-counter',        window.makeAppCounter],
    ['app-scroll-reveal',  window.makeAppScrollReveal],
  ];
  for (var i = 0; i < components.length; i++) {
    app.component(components[i][0], components[i][1]());
  }

  // ── 注册页面组件 ──
  var pages = [
    ['page-diagnose',     window.makePageDiagnose],
    ['page-chat',         window.makePageChat],
    ['page-contribute',   window.makePageContribute],
    ['page-encyclopedia', window.makePageEncyclopedia],
    ['page-history',      window.makePageHistory],
  ];
  for (var j = 0; j < pages.length; j++) {
    app.component(pages[j][0], pages[j][1]());
  }

  // ── 挂载 ──
  app.mount('#app');
})();
