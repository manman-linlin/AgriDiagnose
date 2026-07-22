/** 数字递增动画组件 — 用于统计数字滚动 */
import { toRef } from 'vue';
import { useCountUp } from '../composables/useCountUp.js';

export default {
  name: 'AppCounter',
  props: {
    to:       { type: Number, default: 0 },
    duration: { type: Number, default: 1000 },
  },
  setup(props) {
    const target = toRef(props, 'to');
    const { display } = useCountUp(target, { duration: props.duration });
    return { display };
  },
  template: '<span>{{ display }}</span>',
};
