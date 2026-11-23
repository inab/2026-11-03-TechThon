<script setup lang="ts">
const route = useRoute()
const { loggedIn, user } = useUserSession()
const participant = useParticipant()

// "anni" -> "Anni", "anni-perez" -> "Anni Perez"; "frontend" when running at "/"
const name = computed(() =>
  participant.path
    ? participant.path.split('-').filter(Boolean)
        .map(word => word[0]!.toUpperCase() + word.slice(1)).join(' ')
    : 'frontend',
)

const loginFailed = computed(() => route.query.error === 'auth')
const loginHref = appPath('/auth/keycloak')
</script>

<template>
  <main class="page">
    <h1>
      TechThon
      <span class="highlight">{{ name }}</span>
      demo
    </h1>

    <p v-if="loginFailed" class="notice notice--error" role="alert">
      Login failed. Please try again.
    </p>

    <div class="actions">
      <template v-if="loggedIn">
        <NuxtLink class="button" to="/protected">Open the protected page →</NuxtLink>
        <span class="muted">Logged in as <strong>{{ user?.name || user?.username }}</strong></span>
      </template>
      <!-- Full page navigation on purpose: this is a server route, not a Vue route -->
      <a v-else class="button" :href="loginHref">Log in with Keycloak →</a>
    </div>
  </main>
</template>
