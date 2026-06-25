<script setup lang="ts">
import { usePrinterStore } from '@/stores/printer'
import { usePrinter } from '@/composables/usePrinter'
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { fmtDur, splitPath } from '@/utils/format'

const printer = usePrinterStore()
usePrinter() // starts HTTP polling

const fmtTemp = (c: number) => (c > 0 ? `${c.toFixed(1)}°` : '—')

const estLeft = computed(() => {
  if (printer.printLeftTime > 0) return fmtDur(printer.printLeftTime)
  if (!printer.isPrinting || printer.totalLayers === 0 || printer.currentLayer === 0) return null
  return fmtDur(Math.round((printer.printDuration / printer.currentLayer) * (printer.totalLayers - printer.currentLayer)))
})
const elapsed = computed(() => fmtDur(printer.printDuration))

const showPill = ref(false)
let pillTimer: ReturnType<typeof setTimeout>
const dismiss = () => { showPill.value = false; clearTimeout(pillTimer) }

function togglePill() {
  if (showPill.value) { dismiss() }
  else { showPill.value = true; pillTimer = setTimeout(dismiss, 5000) }
}

onMounted(() => document.addEventListener('click', dismiss))
onUnmounted(() => { document.removeEventListener('click', dismiss); clearTimeout(pillTimer) })

const rawFname = computed(() => splitPath(printer.printFilename))

function tempColor(c: number, t: number) {
  if (t <= 0) return 'var(--text-mute)'
  const r = c / t
  if (r > 0.95) return 'var(--green)'
  if (r > 0.5) return 'var(--amber)'
  return 'var(--text-dim)'
}

function stateBadge(s: string) {
  if (s === 'printing') return 'text-[var(--green)]'
  if (s === 'paused') return 'text-[var(--amber)]'
  if (s === 'complete') return 'text-[var(--blue)]'
  if (s === 'error' || s === 'cancelled') return 'text-[var(--red)]'
  return 'text-[var(--text-mute)]'
}

const hasJob = computed(() => printer.isPrinting || printer.isPaused)
</script>

<template>
  <div class="card p-7 lg:p-8 flex flex-col h-full">
    <!-- Header -->
    <div class="flex items-center justify-between shrink-0 pb-5 max-sm:pb-4">
      <div class="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--green)]">Live status</div>
      <span v-if="hasJob && printer.state && printer.state !== 'unknown'" class="text-[11px] font-semibold uppercase tracking-wider capitalize" :class="stateBadge(printer.state)">
        {{ printer.state }}
      </span>
    </div>

    <div class="flex-1 flex flex-col justify-center gap-5 max-sm:gap-4 lg:gap-8">

    <!-- Temperatures: responsive grid -->
    <div class="grid grid-cols-3 max-sm:grid-cols-1 divide-x max-sm:divide-x-0 max-sm:divide-y divide-white/10 -mx-7 lg:-mx-8">
      <div class="px-7 lg:px-8 max-sm:py-3">
        <div class="t-title mb-3">Extruder</div>
        <div class="flex max-sm:flex-col max-sm:items-start items-baseline gap-1.5 max-sm:gap-0.5">
          <span class="text-[20px] sm:text-[28px] font-semibold tracking-tight tabular-nums" :style="{ color: tempColor(printer.extruderTemp, printer.extruderTarget) }">
            {{ fmtTemp(printer.extruderTemp) }}<span class="text-[0.55em] align-super ml-px">C</span>
          </span>
          <span v-if="printer.extruderTarget > 0" class="t-mono text-[11px] max-sm:hidden"> / {{ printer.extruderTarget.toFixed(0) }}°C</span>
          <span v-if="printer.extruderTarget > 0" class="t-mute text-[10px] hidden max-sm:inline">→ {{ printer.extruderTarget.toFixed(0) }}°C</span>
        </div>
      </div>
      <div class="px-7 lg:px-8 max-sm:py-3">
        <div class="t-title mb-3">Bed</div>
        <div class="flex max-sm:flex-col max-sm:items-start items-baseline gap-1.5 max-sm:gap-0.5">
          <span class="text-[20px] sm:text-[28px] font-semibold tracking-tight tabular-nums" :style="{ color: tempColor(printer.bedTemp, printer.bedTarget) }">
            {{ fmtTemp(printer.bedTemp) }}<span class="text-[0.55em] align-super ml-px">C</span>
          </span>
          <span v-if="printer.bedTarget > 0" class="t-mono text-[11px] max-sm:hidden"> / {{ printer.bedTarget.toFixed(0) }}°C</span>
          <span v-if="printer.bedTarget > 0" class="t-mute text-[10px] hidden max-sm:inline">→ {{ printer.bedTarget.toFixed(0) }}°C</span>
        </div>
      </div>
      <div class="px-7 lg:px-8 max-sm:py-3 max-sm:pb-1">
        <div class="t-title mb-3">Chamber</div>
        <div class="flex max-sm:flex-col max-sm:items-start items-baseline gap-1.5 max-sm:gap-0.5">
          <span class="text-[20px] sm:text-[28px] font-semibold tracking-tight tabular-nums text-[var(--text-dim)]">
            {{ fmtTemp(printer.chamberTemp) }}<span class="text-[0.55em] align-super ml-px">C</span>
          </span>
          <span v-if="printer.chamberTarget > 0" class="t-mono text-[11px] max-sm:hidden"> / {{ printer.chamberTarget.toFixed(0) }}°C</span>
          <span v-if="printer.chamberTarget > 0" class="t-mute text-[10px] hidden max-sm:inline">→ {{ printer.chamberTarget.toFixed(0) }}°C</span>
        </div>
      </div>
    </div>

    <!-- Separator -->
    <div class="h-px bg-[var(--border)] -mx-7 lg:-mx-8"></div>

    <!-- Print job info (shown whenever a job exists) -->
    <div v-if="hasJob" class="flex flex-col gap-5">
      <div class="flex max-sm:flex-col gap-5 items-center">
        <div v-if="printer.thumbnailUrl" class="relative group shrink-0 cursor-pointer">
          <img
            :src="printer.thumbnailUrl"
            class="w-[11.2rem] h-[11.2rem] rounded-lg object-cover bg-[var(--bg-input)] border border-[var(--border)] transition-transform duration-200 sm:group-hover:scale-[2.5] sm:group-hover:z-30 sm:group-hover:shadow-2xl sm:group-hover:rounded-xl origin-left"
          />
        </div>
        <div class="flex-1 min-w-0 flex flex-col justify-center gap-5 max-sm:w-full">
          <div class="flex sm:items-end justify-between gap-6 max-sm:flex-col max-sm:gap-2">
            <div class="flex-1 min-w-0">
              <div class="t-title mb-2">Print job</div>
              <div class="relative">
                <div class="text-[16px] font-medium select-none cursor-pointer truncate" @click.stop="togglePill">{{ rawFname || 'Untitled job' }}</div>
                <div
                  class="absolute bottom-full left-0 mb-2 px-3 py-1.5 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] text-[13px] font-normal leading-snug whitespace-normal break-all max-w-[min(320px,calc(100vw-2.5rem))] shadow-xl z-40 transition-opacity duration-150"
                  :class="showPill ? 'opacity-100' : 'opacity-0 pointer-events-none'"
                >{{ rawFname }}</div>
              </div>
            </div>
            <div class="text-[36px] font-semibold tabular-nums leading-none" :class="printer.isPrinting ? 'text-[var(--green)]' : 'text-[var(--text-dim)]'">
              {{ printer.printProgress }}<span class="text-[18px] text-[var(--text-mute)] ml-0.5">%</span>
            </div>
          </div>

          <progress class="progress" :value="printer.printProgress" max="100"></progress>

          <div class="grid grid-cols-2 sm:grid-cols-2 gap-x-6 gap-y-3">
            <div>
              <div class="t-title">Elapsed</div>
              <div class="t-mono text-[14px] mt-1">{{ elapsed }}</div>
            </div>
            <div>
              <div class="t-title">Remaining</div>
              <div class="t-mono text-[14px] mt-1">{{ estLeft || '—' }}</div>
            </div>
            <div>
              <div class="t-title">Layer</div>
              <div class="t-mono text-[14px] mt-1">{{ printer.currentLayer || '—' }} / {{ printer.totalLayers || '—' }}</div>
            </div>
            <div>
              <div class="t-title">Est. filament</div>
              <div class="t-mono text-[14px] mt-1">
                <template v-if="printer.filamentEstimatedWeight > 0">{{ printer.filamentEstimatedWeight.toFixed(1) }}g</template>
                <template v-else-if="printer.filamentEstimated > 0">{{ (printer.filamentEstimated / 1000).toFixed(1) }}m</template>
                <template v-else>—</template>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Position / Fan / Filament (always visible) -->
    <div class="grid grid-cols-3 max-sm:grid-cols-1 divide-x max-sm:divide-x-0 max-sm:divide-y divide-white/10 -mx-7 lg:-mx-8">
      <div class="px-7 lg:px-8 max-sm:py-4 pt-7 lg:pt-8">
        <div class="t-title mb-3">Position</div>
        <div class="space-y-1.5 t-mono text-[13px]">
          <div class="flex justify-between"><span class="text-[var(--red)]">X</span><span>{{ printer.position.x.toFixed(1) }}</span></div>
          <div class="flex justify-between"><span class="text-[var(--green)]">Y</span><span>{{ printer.position.y.toFixed(1) }}</span></div>
          <div class="flex justify-between"><span class="text-[var(--blue)]">Z</span><span>{{ printer.position.z.toFixed(2) }}</span></div>
        </div>
      </div>
      <div class="px-7 lg:px-8 max-sm:py-4 pt-7 lg:pt-8">
        <div class="t-title mb-3">Part fan</div>
        <div class="flex items-baseline gap-1">
          <span class="text-[24px] sm:text-[28px] font-semibold tabular-nums">{{ Math.round(printer.fanPart * 100) }}</span>
          <span class="t-mono text-[13px]">%</span>
        </div>
      </div>
      <div class="px-7 lg:px-8 max-sm:py-4 pt-7 lg:pt-8">
        <div class="t-title mb-3">Filament used</div>
        <div class="flex items-baseline gap-1">
          <span class="text-[24px] sm:text-[28px] font-semibold tabular-nums">{{ (printer.filamentUsed / 1000).toFixed(1) }}</span>
          <span class="t-mono text-[13px]">m</span>
          <span v-if="printer.filamentUsed > 0" class="t-mute text-[12px] ml-0.5">~{{ (printer.filamentUsed * 0.003).toFixed(1) }}g</span>
        </div>
      </div>
    </div>
    </div>
  </div>
</template>
