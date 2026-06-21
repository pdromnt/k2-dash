<script setup lang="ts">
import { usePrinterStore } from '@/stores/printer'
import { usePrinterWs } from '@/composables/usePrinterWs'
import { computed, onMounted } from 'vue'
import { checkConnection } from '@/api/creality'
import AppBanner from '@/components/layout/AppBanner.vue'

const printer = usePrinterStore()
const printerHost = import.meta.env.VITE_PRINTER_HOST || ''
const printerWs = usePrinterWs()
const isDev = import.meta.env.DEV

const stateColor = computed(() => {
  if (printer.connected) return 'var(--blue)'
  if (printer.isPrinting) return 'var(--green)'
  if (printer.isPaused) return 'var(--amber)'
  if (printer.isError) return 'var(--red)'
  if (printer.isReady) return 'var(--blue)'
  return 'var(--text-mute)'
})

const stateLabel = computed(() => {
  const base = printer.isPrinting ? 'PRINTING'
    : printer.isPaused ? 'PAUSED'
    : printer.isError ? 'ERROR'
    : printer.isReady ? 'READY'
    : printer.connected ? 'CONNECTED'
    : 'OFFLINE'
  const mode = printerWs.connected.value ? 'WS' : 'HTTP'
  return `${base} · ${mode}`
})

onMounted(async () => {
  try {
    await checkConnection()
    printer.connected = true
  } catch {
    printer.connected = false
  }
  printerWs.connect()
})
</script>

<template>
  <div class="flex flex-col h-screen bg-[var(--bg-page)]">
    <!-- ── Top bar ── -->
    <header class="shrink-0 h-16 px-6 lg:px-10 flex items-center justify-between border-b border-[var(--border)]">
      <div class="flex items-center gap-8">
        <div class="flex items-baseline gap-1.5 leading-none">
          <span class="text-[16px] font-semibold tracking-tight text-[var(--green)]">K2</span>
          <span class="text-[16px] font-semibold tracking-tight text-[var(--text-dim)]">Dash</span>
        </div>
        <div class="h-5 w-px bg-[var(--border-strong)]"></div>
        <div class="flex items-center gap-2.5">
          <span class="w-2 h-2 rounded-full" :style="{ backgroundColor: stateColor }"></span>
          <span class="text-[13px] font-medium" :style="{ color: stateColor }">{{ stateLabel }}</span>
        </div>
      </div>

      <div class="flex items-center gap-3">
        <span
          v-if="isDev"
          class="text-[12px] font-mono text-[var(--text-mute)]"
        >
          {{ printerHost }}
        </span>
      </div>
    </header>

    <!-- ── Banners ── -->
    <AppBanner />

    <!-- ── Main content ── -->
    <main class="flex-1 overflow-y-auto">
      <slot />
    </main>
  </div>
</template>
