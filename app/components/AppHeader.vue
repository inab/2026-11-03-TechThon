<script setup lang="ts">
const { loggedIn, user } = useUserSession()

const loginHref = appPath('/auth/keycloak')
const logoutHref = appPath('/auth/logout')
</script>

<template>
  <header class="app-header">
    <div class="app-header__inner">
      <NuxtLink to="/" class="brand">
        <span class="brand__mark" aria-hidden="true">T</span>
        <span class="brand__name">TechThon</span>
      </NuxtLink>

      <nav class="app-header__nav" aria-label="Main">
        <NuxtLink to="/">Home</NuxtLink>
        <NuxtLink v-if="loggedIn" to="/protected">Protected</NuxtLink>
      </nav>

      <div class="app-header__session">
        <!-- Full page navigation on purpose: these are server routes, not Vue routes -->
        <template v-if="loggedIn">
          <span class="app-header__user">{{ user?.name || user?.username }}</span>
          <a class="button button--ghost button--small" :href="logoutHref">Log out</a>
        </template>
        <a v-else class="button button--small" :href="loginHref">Log in</a>
      </div>
    </div>
  </header>
</template>
