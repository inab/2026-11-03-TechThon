<script setup lang="ts">
import type { StackLayer } from '#shared/types/stack'

// Fetched from the browser on purpose: the request really goes through the
// Ingress, so every layer shows what happened to *this* request.
const layers = ref<StackLayer[]>([])
const failed = ref(false)
const open = ref(false)
const selected = ref('browser')

const current = computed(() => layers.value.find(layer => layer.id === selected.value))

// Vertical position of each plate, in "gaps". Nested layers (pod inside the
// node, container inside the pod, app inside the container) sit closer together.
const positions = computed(() => {
  let at = 0
  return layers.value.map((layer, index) => {
    if (index > 0) at += layer.depth ? 0.8 : 1
    return at
  })
})
const total = computed(() => positions.value.at(-1) ?? 0)

// "15:30:52 (3 min ago)" / "15:35:52 (in 4 min)"
const relative = new Intl.RelativeTimeFormat('en', { numeric: 'auto' })
function formatTime(iso: string): string {
  const date = new Date(iso)
  const seconds = Math.round((date.getTime() - Date.now()) / 1000)
  const [amount, unit]: [number, Intl.RelativeTimeFormatUnit]
    = Math.abs(seconds) < 60
      ? [seconds, 'second']
      : Math.abs(seconds) < 3600
        ? [Math.round(seconds / 60), 'minute']
        : Math.abs(seconds) < 86400
          ? [Math.round(seconds / 3600), 'hour']
          : [Math.round(seconds / 86400), 'day']
  return `${date.toLocaleTimeString()} (${relative.format(amount, unit)})`
}

onMounted(async () => {
  const start = performance.now()
  try {
    const data = await $fetch<{ layers: StackLayer[] }>(appPath('/api/stack'))
    const ms = Math.round(performance.now() - start)
    data.layers[0]?.items.push({ label: 'Round trip', value: `${ms} ms` })
    layers.value = data.layers
    // Let the collapsed stack render first, so it visibly opens.
    setTimeout(() => (open.value = true), 150)
  }
  catch {
    failed.value = true
  }
})
</script>

<template>
  <section class="stack" aria-labelledby="stack-title">
    <h2 id="stack-title">How this page reached you</h2>
    <p class="muted">
      The layers your request went through just now, from outside to inside.
      Click one to see its details.
    </p>

    <p v-if="failed" class="notice notice--error" role="alert">Could not load the stack.</p>
    <p v-else-if="!layers.length" class="muted">Loading…</p>

    <div v-else class="stack__body">
      <ol
        class="stack__layers"
        :class="{ 'stack__layers--open': open }"
        :style="{ '--count': layers.length, '--total': total }"
      >
        <li
          v-for="(layer, index) in layers"
          :key="layer.id"
          class="stack__row"
          :class="{ 'stack__row--active': layer.id === selected, 'stack__row--side': layer.side }"
          :style="{ '--i': index, '--at': positions[index], '--scale': 1 - (layer.depth ?? 0) * 0.14 }"
        >
          <button
            type="button"
            class="stack__button"
            :aria-pressed="layer.id === selected"
            @click="selected = layer.id"
          >
            <span class="stack__plate-wrap" aria-hidden="true">
              <span class="stack__plate">
                <span class="stack__plate-name">{{ layer.title }}</span>
              </span>
            </span>
            <span class="stack__label">
              <span class="stack__index">{{ String(index + 1).padStart(2, '0') }}</span>
              <span class="stack__title">{{ layer.title }}</span>
              <span class="stack__summary">{{ layer.short }}</span>
            </span>
          </button>
        </li>
      </ol>

      <div v-if="current" class="card stack__details" aria-live="polite">
        <h3>{{ current.title }}</h3>
        <p class="stack__description">{{ current.description }}</p>
        <dl>
          <template v-for="item in current.items" :key="item.label">
            <dt>{{ item.label }}</dt>
            <dd>{{ item.time ? formatTime(item.value) : item.value }}</dd>
          </template>
        </dl>
      </div>
    </div>
  </section>
</template>
