<script setup lang="ts">
import BatteryEmpty  from './icons/BatteryEmpty.vue'
import BatteryLow from './icons/BatteryLow.vue'
import BatteryMedium from './icons/BatteryMedium.vue'
import BatteryFull from './icons/BatteryFull.vue'

defineProps<{
  duration?: number
}>()
</script>

<template>
  <div class="battery-throbber" aria-label="Loading…" aria-live="polite" role="status" :style="{ '--cycle-duration': `${duration ?? 2000}ms` }">
    <BatteryEmpty class="battery" />
    <BatteryEmpty class="battery animated battery-empty" />
    <BatteryLow class="battery animated battery-low" />
    <BatteryMedium class="battery animated battery-medium" />
    <BatteryFull class="battery animated battery-full" />
  </div>
</template>

<style scoped>
.battery-throbber {
  position: relative;
  height: 1.2em;
  width: 1.2em;
  display: inline-block;
}

.battery {
  height: 100%;
  inset: 0;
  position: absolute;
  stroke-width: 1.5;
  width: 100%;
}


.battery.animated {
  animation: battery-sequence var(--cycle-duration, 1200ms) steps(1) infinite;
  height: 100%;
  inset: 0;
  left: 0;
  opacity: 0;
  position: absolute;
  stroke-width: 2;
  top: 0;
  width: 100%;
}

.battery.animated.battery-empty  { animation-delay: calc(var(--cycle-duration) * 0/4); }
.battery.animated.battery-low  { animation-delay: calc(var(--cycle-duration) * 1/4); }
.battery.animated.battery-medium  { animation-delay: calc(var(--cycle-duration) * 2/4); }
.battery.animated.battery-full  { animation-delay: calc(var(--cycle-duration) * 3/4); }

@keyframes battery-sequence {
  0%       { opacity: 1; }
  25%      { opacity: 0; }
}
</style>
