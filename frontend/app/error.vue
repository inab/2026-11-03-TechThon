<script setup lang="ts">
import type { NuxtError } from '#app'

defineProps<{ error: NuxtError }>()

const handleClear = () => clearError({ redirect: '/' })
</script>

<template>
  <div class="layout">
    <main class="page">
      <p class="error-code">{{ error.statusCode }}</p>
      <h1>{{ error.statusCode === 404 ? 'Page not found.' : 'Something went wrong.' }}</h1>
      <div class="actions">
        <button type="button" class="button" @click="handleClear">Back to the start page</button>
      </div>
    </main>
  </div>
</template>
