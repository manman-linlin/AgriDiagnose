/**
 * 滚动触发揭示组件
 * 子元素进入视口时自动添加 .revealed 类触发 CSS 动画。
 * 对每个直接子元素独立监听。
 *
 * Props:
 *   threshold - 可见比例触发阈值 (Number, default 0.15)
 *   once      - 是否只触发一次 (Boolean, default true)
 *   delay     - 延迟 ms (Number, default 0)
 *   stagger   - 子元素之间错位延迟 ms (Number, default 80)
 *
 * 用法：
 *   <app-scroll-reveal :stagger="80">
 *     <div class="scroll-reveal">...</div>
 *     <div class="scroll-reveal">...</div>
 *   </app-scroll-reveal>
 *
 * 子元素需具备 .scroll-reveal / .scroll-reveal-left / .scroll-reveal-right / .scroll-reveal-scale 等类。
 */
window.makeAppScrollReveal = function () {
  return {
    props: {
      threshold: { type: Number, default: 0.15 },
      once:      { type: Boolean, default: true },
      delay:     { type: Number, default: 0 },
      stagger:   { type: Number, default: 80 },
    },
    data() {
      return {
        observer: null,
        revealed: false,
      };
    },
    methods: {
      setupObserver() {
        if (typeof IntersectionObserver === 'undefined') {
          // 降级：全部直接显示
          setTimeout(() => {
            const children = this.$el.children;
            for (let i = 0; i < children.length; i++) {
              children[i].classList.add('revealed');
            }
          }, this.delay);
          return;
        }

        const self = this;
        this.observer = new IntersectionObserver(
          function (entries) {
            for (let i = 0; i < entries.length; i++) {
              const entry = entries[i];
              if (entry.isIntersecting) {
                const el = entry.target;
                const index = parseInt(el.dataset.revealIndex || '0', 10);
                const staggerDelay = index * self.stagger;

                setTimeout(function () {
                  el.classList.add('revealed');
                }, staggerDelay);

                if (self.once) {
                  self.observer.unobserve(el);
                }
              } else if (!self.once) {
                entry.target.classList.remove('revealed');
              }
            }
          },
          { threshold: this.threshold, rootMargin: '0px 0px -30px 0px' }
        );

        // 延迟后开始观察每个子元素
        setTimeout(function () {
          const children = self.$el.children;
          for (let i = 0; i < children.length; i++) {
            const child = children[i];
            child.dataset.revealIndex = String(i);
            self.observer.observe(child);
          }
          self.revealed = true;
        }, this.delay);
      },
    },

    mounted() {
      this.setupObserver();
    },

    beforeUnmount() {
      if (this.observer) this.observer.disconnect();
    },

    template: '<div style="display:contents;"><slot></slot></div>',
  };
};
