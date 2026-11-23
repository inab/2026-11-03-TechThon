<script setup lang="ts">
const route = useRoute()

// Says which kind of page this is: public, or only for logged-in users.
const footer = computed(() =>
  route.meta.middleware === 'auth'
    ? 'This is the protected page. Only logged-in users can see it.'
    : 'This is the public page. Anyone can see it.',
)
</script>

<template>
  <div class="layout">
    <AppHeader />
    <slot />
    <footer class="app-footer">
      <div class="app-footer__inner">{{ footer }}</div>
    </footer>
  </div>
</template>
