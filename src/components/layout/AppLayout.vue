<script setup lang="ts">
import { usePrinterStore } from '@/stores/printer'
import { usePrinterWs } from '@/composables/usePrinterWs'
import { computed, onMounted, ref, watch } from 'vue'
import { checkConnection } from '@/api/creality'
import AppBanner from '@/components/layout/AppBanner.vue'

const printer = usePrinterStore()
const printerHost = import.meta.env.VITE_PRINTER_HOST || ''
const printerWs = usePrinterWs()
const isDev = import.meta.env.DEV
const showOffline = ref(false)
const everConnected = ref(false)
const connectionBanner = ref('')
let offlineSince: number | null = null
let tickTimer: ReturnType<typeof setInterval> | null = null

// Reactive connection monitoring — WS is the primary health signal
watch(() => printerWs.connected.value, (wsOk) => {
  if (wsOk) {
    showOffline.value = false
    offlineSince = null
    connectionBanner.value = ''
    if (tickTimer) { clearInterval(tickTimer); tickTimer = null }
    if (!everConnected.value) everConnected.value = true
    return
  }

  // WS dropped — start counting
  if (offlineSince === null) {
    offlineSince = Date.now()
    // Tick every second to update the counter
    if (!tickTimer) {
      tickTimer = setInterval(() => {
        if (offlineSince === null) return
        const secs = Math.round((Date.now() - offlineSince) / 1000)
        if (!everConnected.value && secs > 15) showOffline.value = true
        if (everConnected.value && secs > 4) connectionBanner.value = `Connection lost — reconnecting (${secs}s)`
      }, 1000)
    }
  }
}, { immediate: true })

const stateColor = computed(() => {
  if (showOffline.value) return 'var(--text-mute)'
  if (printer.isPrinting) return 'var(--green)'
  if (printer.isPaused) return 'var(--amber)'
  if (printer.isError) return 'var(--red)'
  if (printer.connected) return 'var(--blue)'
  return 'var(--text-mute)'
})

const stateLabel = computed(() => {
  if (showOffline.value) return 'OFFLINE'
  // WS is primary — if it drops, we're reconnecting regardless of HTTP
  if (!printerWs.connected.value) return 'RECONNECTING'
  return printer.isPrinting ? 'PRINTING'
    : printer.isPaused ? 'PAUSED'
    : printer.isError ? 'ERROR'
    : printer.isReady ? 'READY'
    : printer.connected ? 'CONNECTED'
    : 'OFFLINE'
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
        <div class="flex items-baseline leading-none">
          <span class="text-[16px] font-semibold tracking-tight text-[var(--green)]">K2</span><span class="text-[16px] font-semibold tracking-tight text-[var(--text-dim)]">Dash</span>
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
    <div v-if="connectionBanner" class="shrink-0 px-6 py-2.5 text-[13px] font-medium text-center bg-[rgba(224,85,85,0.1)] border-b border-[rgba(224,85,85,0.2)] text-[var(--red)]">
      {{ connectionBanner }}
    </div>

    <!-- ── Offline screen ── -->
    <div v-if="showOffline" class="flex-1 flex items-center justify-center bg-[var(--bg-page)] p-10">
      <div class="text-center max-w-md">
        <div class="w-20 h-20 mx-auto mb-8 rounded-2xl bg-[var(--bg-card)] border border-[var(--border)] flex items-center justify-center">
          <svg class="w-10 h-10 text-[var(--red)]/70" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
          </svg>
        </div>
        <h1 class="text-[22px] font-semibold text-[var(--text)] mb-3 tracking-tight">Couldn't connect to printer</h1>
        <p class="text-[14px] text-[var(--text-dim)] leading-relaxed">
          Make sure the printer is powered on and connected to the same network.
          Check that <code class="text-[var(--green)] text-[13px]">{{ printerHost || 'VITE_PRINTER_HOST' }}</code> is reachable.
        </p>
      </div>
    </div>

    <!-- ── Main content ── -->
    <main v-else class="flex-1 overflow-y-auto">
      <slot />
    </main>
  </div>
</template>
