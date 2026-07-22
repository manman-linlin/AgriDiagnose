/**
 * 防抖 ref：source 变化后延迟 delay ms 才更新返回的 debounced ref。
 * 复用场景：百科页搜索框。
 */
import { ref, watch, onBeforeUnmount } from 'vue';

export function useDebouncedRef(sourceRef, delay = 300) {
  const debounced = ref(sourceRef.value);
  let timer = null;

  watch(sourceRef, (val) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      debounced.value = val;
    }, delay);
  });

  onBeforeUnmount(() => {
    if (timer) clearTimeout(timer);
  });

  return debounced;
}
