<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { getHistoryList, type HistoryJob } from '@/api/moonraker'
import { useBannerStore } from '@/stores/banner'

const jobs = ref<HistoryJob[]>([])
const loading = ref(false)
const banner = useBannerStore()

const fmtDur = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
const fmtDate = (ts: number) => new Date(ts * 1000).toLocaleString()

function statusColor(s: string) {
  if (s === 'completed') return 'var(--green)'
  if (s === 'cancelled') return 'var(--amber)'
  if (s === 'error') return 'var(--red)'
  return 'var(--text-mute)'
}

async function load() {
  loading.value = true
  try {
    const d = await getHistoryList()
    jobs.value = d.jobs || []
  } catch (e) {
    banner.show('Failed to fetch history', e instanceof Error ? e.message : undefined)
  }
  loading.value = false
}

onMounted(load)
</script>

<template>
  <div class="card p-7 lg:p-8 flex flex-col gap-6 h-full">
    <div class="flex items-center justify-between">
      <div class="t-title">History</div>
      <div class="flex items-center gap-3">
        <span v-if="!loading && jobs.length > 0" class="t-mute font-mono">{{ jobs.length }} jobs</span>
        <button class="btn btn-ghost btn-sm" @click="load" :disabled="loading" aria-label="Reload">
          <svg class="w-3.5 h-3.5" :class="{ 'animate-spin': loading }" fill="none" stroke="currentColor" viewBox="0 0 24 24" stroke-width="1.5">
            <path stroke-linecap="round" stroke-linejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>
    </div>

    <div class="flex-1 min-h-0 -mx-7 lg:-mx-8 overflow-y-auto">
      <div v-if="loading" class="px-7 lg:px-8 py-16 text-center text-[var(--text-mute)]">
        <span class="loading loading-spinner loading-sm"></span>
        <p class="mt-3 t-mute">Loading…</p>
      </div>

      <div v-else-if="jobs.length === 0" class="px-7 lg:px-8 py-16 text-center text-[var(--text-mute)]">
        <p class="text-[13px]">No history yet</p>
      </div>

      <ul v-else class="divide-y divide-[var(--border)]">
        <li v-for="j in jobs" :key="j.job_id" class="px-7 lg:px-8 py-5 hover:bg-white/[0.015] transition-colors">
          <div class="flex items-center gap-4">
            <div class="flex-1 min-w-0">
              <div class="text-[14px] font-medium truncate" :title="j.filename">{{ j.filename }}</div>
              <div class="t-mono text-[12px] mt-1">
                {{ fmtDate(j.start_time) }} · {{ fmtDur(j.print_duration) }} · {{ (j.filament_used / 1000).toFixed(1) }}m
              </div>
            </div>
            <span class="text-[11px] font-semibold uppercase tracking-wider" :style="{ color: statusColor(j.status) }">
              {{ j.status }}
            </span>
          </div>
        </li>
      </ul>
    </div>
  </div>
</template>
