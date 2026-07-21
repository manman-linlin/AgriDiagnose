/** 数字递增动画组件 — 用于统计数字滚动 */
window.makeAppCounter = function () {
  return {
    props: {
      to:       { type: Number, default: 0 },
      duration: { type: Number, default: 1000 },
    },
    data() {
      return {
        display: 0,
        timer: null,
      };
    },
    watch: {
      to: {
        handler(newVal) {
          this.animate(newVal);
        },
        immediate: true,
      },
    },
    methods: {
      animate(target) {
        if (this.timer) cancelAnimationFrame(this.timer);
        const start = this.display;
        const duration = this.duration;
        const startTime = performance.now();

        const step = (now) => {
          const elapsed = now - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const eased = 1 - Math.pow(1 - progress, 3);
          this.display = Math.round(start + (target - start) * eased);

          if (progress < 1) {
            this.timer = requestAnimationFrame(step);
          } else {
            this.display = target;
          }
        };
        this.timer = requestAnimationFrame(step);
      },
    },
    beforeUnmount() {
      if (this.timer) cancelAnimationFrame(this.timer);
    },
    template: '<span>{{ display }}</span>',
  };
};
