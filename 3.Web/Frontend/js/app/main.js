/**
 * AgriDiagnose — 应用入口
 * ES Modules + Pinia，零构建（浏览器原生 <script type="module"> 直接运行）。
 */
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.js';

const app = createApp(App);

// Vue 默认只把渲染/setup 阶段的错误 console.error，不会抛到 window.onerror，
// 这里显式接管一次，方便零构建环境下没有 sourcemap 也能在页面上看到具体报错。
app.config.errorHandler = (err, instance, info) => {
  console.error('[Vue Error]', info, err);
  if (window.__pushError) {
    window.__pushError('[Vue: ' + info + '] ' + (err && err.stack ? err.stack : err));
  }
};

app.use(createPinia());
app.mount('#app');
