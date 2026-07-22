/**
 * 数字递增/递减动画 composable。
 * 监听目标数值 ref/computed，用 requestAnimationFrame 做 ease-out cubic 过渡。
 * 复用场景：结果卡置信度数字、统计计数器。
 */
import { ref, watch, onBeforeUnmount } from 'vue';

export function useCountUp(targetRef, { duration = 1000, immediate = true } = {}) {
  const display = ref(0);
  let raf = null;

  function animate(target) {
    if (raf) cancelAnimationFrame(raf);
    const start = display.value;
    const startTime = performance.now();

    const step = (now) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      display.value = Math.round(start + (target - start) * eased);

      if (progress < 1) {
        raf = requestAnimationFrame(step);
      } else {
        display.value = target;
      }
    };
    raf = requestAnimationFrame(step);
  }

  watch(targetRef, (val) => animate(val ?? 0), { immediate });

  onBeforeUnmount(() => {
    if (raf) cancelAnimationFrame(raf);
  });

  return { display, animate };
}
