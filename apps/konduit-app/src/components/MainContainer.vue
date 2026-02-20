<template>
  <div class="main-container">
    <slot />
  </div>
</template>

<style scoped>
.main-container {
  padding: 0 var(--main-container-padding);
  padding-bottom: var(--navbar-padding-bottom);
}
</style>
