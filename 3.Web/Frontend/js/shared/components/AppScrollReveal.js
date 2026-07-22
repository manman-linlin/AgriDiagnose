/**
 * 滚动触发揭示组件
 * 子元素进入视口时自动添加 .revealed 类触发 CSS 动画。
 * 用法：
 *   <app-scroll-reveal :stagger="80">
 *     <div class="scroll-reveal">...</div>
 *   </app-scroll-reveal>
 */
import { ref, onMounted, onBeforeUnmount } from 'vue';

export default {
  name: 'AppScrollReveal',
  props: {
    threshold: { type: Number, default: 0.15 },
    once:      { type: Boolean, default: true },
    delay:     { type: Number, default: 0 },
    stagger:   { type: Number, default: 80 },
  },
  setup(props) {
    const rootEl = ref(null);
    let observer = null;

    function setupObserver() {
      const el = rootEl.value;
      if (!el) return;

      if (typeof IntersectionObserver === 'undefined') {
        setTimeout(() => {
          Array.from(el.children).forEach((child) => child.classList.add('revealed'));
        }, props.delay);
        return;
      }

      observer = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting) {
              const target = entry.target;
              const index = parseInt(target.dataset.revealIndex || '0', 10);
              const staggerDelay = index * props.stagger;
              setTimeout(() => target.classList.add('revealed'), staggerDelay);
              if (props.once) observer.unobserve(target);
            } else if (!props.once) {
              entry.target.classList.remove('revealed');
            }
          });
        },
        { threshold: props.threshold, rootMargin: '0px 0px -30px 0px' }
      );

      setTimeout(() => {
        Array.from(el.children).forEach((child, i) => {
          child.dataset.revealIndex = String(i);
          observer.observe(child);
        });
      }, props.delay);
    }

    onMounted(setupObserver);
    onBeforeUnmount(() => {
      if (observer) observer.disconnect();
    });

    return { rootEl };
  },
  template: '<div ref="rootEl" style="display:contents;"><slot></slot></div>',
};
