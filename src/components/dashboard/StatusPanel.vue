<script setup lang="ts">
import { usePrinterStore } from '@/stores/printer'
import { usePrinter } from '@/composables/usePrinter'
import { useBannerStore } from '@/stores/banner'
import { computed, watch } from 'vue'

const printer = usePrinterStore()
const { error } = usePrinter()
const banner = useBannerStore()

watch(error, (msg) => {
  if (msg) banner.show('Failed to fetch status', msg)
})

const fmtDur = (s: number) => {
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  return h > 0 ? `${h}h ${m}m` : `${m}m`
}
const fmtTemp = (c: number) => (c > 0 ? `${c.toFixed(1)}°` : '—')

const estLeft = computed(() => {
  if (printer.printLeftTime > 0) return fmtDur(printer.printLeftTime)
  if (!printer.isPrinting || printer.totalLayers === 0 || printer.currentLayer === 0) return null
  return fmtDur(Math.round((printer.printDuration / printer.currentLayer) * (printer.totalLayers - printer.currentLayer)))
})
const elapsed = computed(() => fmtDur(printer.printDuration))
const fname = computed(() => printer.printFilename.replace(/\.gcode$/i, ''))

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

const hasJob = computed(() => !!printer.printFilename)
</script>

<template>
  <div class="card p-7 lg:p-8 flex flex-col gap-7 lg:gap-8 h-full">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div class="text-[13px] font-semibold uppercase tracking-[0.12em] text-[var(--green)]">Live status</div>
      <span v-if="hasJob" class="text-[11px] font-semibold uppercase tracking-wider capitalize" :class="stateBadge(printer.state)">
        {{ printer.state }}
      </span>
    </div>

    <!-- Temperatures: responsive grid -->
    <div class="grid grid-cols-3 divide-x divide-[var(--border)] -mx-7 lg:-mx-8">
      <div class="px-7 lg:px-8">
        <div class="t-title mb-3">Extruder</div>
        <div class="flex max-sm:flex-col max-sm:items-start items-baseline gap-1.5 max-sm:gap-0.5">
          <span class="text-[24px] sm:text-[28px] font-semibold tracking-tight tabular-nums" :style="{ color: tempColor(printer.extruderTemp, printer.extruderTarget) }">
            {{ fmtTemp(printer.extruderTemp) }}
          </span>
          <span v-if="printer.extruderTarget > 0" class="t-mono text-[13px] max-sm:hidden"> / {{ printer.extruderTarget.toFixed(0) }}°</span>
          <span v-if="printer.extruderTarget > 0" class="t-mute text-[11px] hidden max-sm:inline">→ {{ printer.extruderTarget.toFixed(0) }}°</span>
        </div>
      </div>
      <div class="px-7 lg:px-8">
        <div class="t-title mb-3">Bed</div>
        <div class="flex max-sm:flex-col max-sm:items-start items-baseline gap-1.5 max-sm:gap-0.5">
          <span class="text-[24px] sm:text-[28px] font-semibold tracking-tight tabular-nums" :style="{ color: tempColor(printer.bedTemp, printer.bedTarget) }">
            {{ fmtTemp(printer.bedTemp) }}
          </span>
          <span v-if="printer.bedTarget > 0" class="t-mono text-[13px] max-sm:hidden"> / {{ printer.bedTarget.toFixed(0) }}°</span>
          <span v-if="printer.bedTarget > 0" class="t-mute text-[11px] hidden max-sm:inline">→ {{ printer.bedTarget.toFixed(0) }}°</span>
        </div>
      </div>
      <div class="px-7 lg:px-8">
        <div class="t-title mb-3">Chamber</div>
        <div class="flex max-sm:flex-col max-sm:items-start items-baseline gap-1.5 max-sm:gap-0.5">
          <span class="text-[24px] sm:text-[28px] font-semibold tracking-tight tabular-nums text-[var(--text-dim)]">
            {{ fmtTemp(printer.chamberTemp) }}
          </span>
          <span v-if="printer.chamberTarget > 0" class="t-mono text-[13px] max-sm:hidden"> / {{ printer.chamberTarget.toFixed(0) }}°</span>
          <span v-if="printer.chamberTarget > 0" class="t-mute text-[11px] hidden max-sm:inline">→ {{ printer.chamberTarget.toFixed(0) }}°</span>
        </div>
      </div>
    </div>

    <!-- Print job info (shown whenever a job exists) -->
    <div v-if="hasJob" class="flex flex-col gap-5">
      <div class="h-px bg-[var(--border)] -mx-7 lg:-mx-8"></div>

      <div class="flex max-sm:flex-col gap-5">
        <img
          v-if="printer.thumbnailUrl"
          :src="printer.thumbnailUrl"
          class="w-32 h-32 rounded-lg object-cover shrink-0 bg-[var(--bg-input)] border border-[var(--border)]"
        />
        <div class="flex-1 min-w-0 flex flex-col justify-center gap-5">
          <div class="flex items-end justify-between gap-6">
            <div class="min-w-0">
              <div class="t-title mb-2">Print job</div>
              <div class="text-[16px] font-medium truncate" :title="fname">{{ fname || 'Untitled job' }}</div>
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
    <div class="grid grid-cols-3 max-sm:grid-cols-1 divide-x max-sm:divide-x-0 max-sm:divide-y divide-[var(--border)] -mx-7 lg:-mx-8" :class="hasJob ? 'border-t border-[var(--border)]' : 'border-t border-[var(--border)]'">
      <div class="px-7 lg:px-8 max-sm:py-4 pt-7 lg:pt-8">
        <div class="t-title mb-3">Position</div>
        <div class="space-y-1.5 t-mono text-[13px]">
          <div class="flex justify-between"><span style="color: var(--red)">X</span><span>{{ printer.position.x.toFixed(1) }}</span></div>
          <div class="flex justify-between"><span style="color: var(--green)">Y</span><span>{{ printer.position.y.toFixed(1) }}</span></div>
          <div class="flex justify-between"><span style="color: var(--blue)">Z</span><span>{{ printer.position.z.toFixed(2) }}</span></div>
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
</template>
