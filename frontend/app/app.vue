<script setup lang="ts">
const { path } = useParticipant()

useHead({
  // Browser tab: "anni · TechThon frontend demo", so participants with several
  // tabs open can tell their apps apart.
  titleTemplate: title => (path ? `${path} · ${title}` : title || ''),
  // Built at runtime so the icon is found under the participant's path.
  link: [{ rel: 'icon', type: 'image/svg+xml', href: appPath('/favicon.svg') }],
})
</script>

<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
</template>
