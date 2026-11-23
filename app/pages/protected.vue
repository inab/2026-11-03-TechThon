<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const logoutHref = appPath('/auth/logout')
</script>

<template>
  <main class="page">
    <h1>You're <span class="highlight">in</span>.</h1>

    <StackView />

    <div class="actions">
      <!-- Full page navigation on purpose: this is a server route, not a Vue route -->
      <a class="button button--danger" :href="logoutHref">Log out</a>
    </div>
  </main>
</template>
