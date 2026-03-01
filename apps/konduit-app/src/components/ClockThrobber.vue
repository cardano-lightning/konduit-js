<script setup lang="ts">
import Clock12  from './icons/Clock12.vue'
import Clock03  from './icons/Clock03.vue'
import Clock06  from './icons/Clock06.vue'
import Clock09  from './icons/Clock09.vue'

defineProps<{
  duration?: number
}>()
</script>

<template>
  <div class="clock-throbber" aria-label="Loading…" aria-live="polite" role="status" :style="{ '--cycle-duration': `${duration ?? 1200}ms` }">
    <Clock12 class="clock" />
    <Clock12 class="clock animated clock-12" />
    <Clock03 class="clock animated clock-03" />
    <Clock06 class="clock animated clock-06" />
    <Clock09 class="clock animated clock-09" />
  </div>
</template>

<style scoped>
.clock-throbber {
  position: relative;
  height: 1.2em;
  width: 1.2em;
  display: inline-block;
}

.clock {
  height: 100%;
  inset: 0;
  opacity: 0.6;
  position: absolute;
  stroke-width: 1.5;
  width: 100%;
}


.clock.animated {
  animation: clock-sequence var(--cycle-duration, 1200ms) steps(4) infinite;
  height: 100%;
  inset: 0;
  left: 0;
  opacity: 0;
  position: absolute;
  stroke-width: 1.5;
  top: 0;
  width: 100%;
}

/* Staggered delays — each is 1/12th of the cycle earlier */
.clock.animated.clock-12  { animation-delay: calc(var(--cycle-duration) * 0/4); }
/* .clock.animated.clock-01  { animation-delay: calc(var(--cycle-duration) * 1/12); } */
/* .clock.animated.clock-02  { animation-delay: calc(var(--cycle-duration) * 2/12); } */
.clock.animated.clock-03  { animation-delay: calc(var(--cycle-duration) * 1/4); }
/* .clock.animated.clock-04  { animation-delay: calc(var(--cycle-duration) * 4/12); } */
/* .clock.animated.clock-05  { animation-delay: calc(var(--cycle-duration) * 5/12); } */
.clock.animated.clock-06  { animation-delay: calc(var(--cycle-duration) * 2/4); }
/* .clock.animated.clock-07  { animation-delay: calc(var(--cycle-duration) * 7/12); } */
/* .clock.animated.clock-08  { animation-delay: calc(var(--cycle-duration) * 8/12); } */
.clock.animated.clock-09  { animation-delay: calc(var(--cycle-duration) * 3/4); }
/* .clock.animated.clock-10  { animation-delay: calc(var(--cycle-duration) * 10/12); } */
/* .clock.animated.clock-11  { animation-delay: calc(var(--cycle-duration) * 11/12); } */

@keyframes clock-sequence {
  0%       { opacity: 0.6; }
  24%      { opacity: 0; }
}
</style>
